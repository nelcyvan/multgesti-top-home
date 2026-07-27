import http from "node:http";
import fs from "node:fs";
import { URL } from "node:url";

const host = process.env.DEBUG_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.DEBUG_SERVER_PORT || process.env.PORT || 7777);
const outDir = process.env.DEBUG_SERVER_OUTDIR || "/home/multgesti/.dbg";
const logFilePath = process.env.DEBUG_SERVER_LOG_FILE || `${outDir}/debug-server-7777.ndjson`;

fs.mkdirSync(outDir, { recursive: true });

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function appendNdjsonLine(line) {
  fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
}

function tailNdjsonLines(maxLines) {
  const safeLines = Number.isFinite(maxLines) ? Math.max(1, Math.min(2000, maxLines)) : 200;
  try {
    const stat = fs.statSync(logFilePath);
    const readSize = Math.min(stat.size, 256 * 1024);
    const fd = fs.openSync(logFilePath, "r");
    try {
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
      const text = buf.toString("utf8");
      const lines = text.split("\n").filter(Boolean);
      return lines.slice(Math.max(0, lines.length - safeLines));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok", port, host, logFilePath });
  }

  if (method === "POST" && url.pathname === "/event") {
    try {
      const body = await readJsonBody(req);
      const payload =
        body && typeof body === "object"
          ? { ...body, receivedAt: Date.now() }
          : { receivedAt: Date.now(), raw: body };
      appendNdjsonLine(JSON.stringify(payload));
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (method === "GET" && url.pathname === "/logs") {
    const tail = Number(url.searchParams.get("tail") || 200);
    const lines = tailNdjsonLines(tail).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    return sendJson(res, 200, { count: lines.length, rows: lines });
  }

  if (method === "DELETE" && url.pathname === "/logs") {
    try {
      fs.writeFileSync(logFilePath, "", "utf8");
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return sendJson(res, 404, { message: "not found" });
});

server.listen(port, host, () => {
  process.stdout.write(`debug-server listening on http://${host}:${port}\n`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
