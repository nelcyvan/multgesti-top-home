function getEvolutionBaseUrl(apiUrl) {
  return String(apiUrl || "").replace(/\/+$/, "");
}

function getEvolutionHeaders(apiKey) {
  return { "Content-Type": "application/json", apikey: apiKey || "" };
}

async function parseEvolutionPayload(response) {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

export function extractEvolutionMessage(payload, fallback) {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (payload.response && typeof payload.response.message === "string" && payload.response.message.trim()) {
      return payload.response.message;
    }
    if (payload.base64 || payload.code || payload.pairingCode) {
      return "Instância aguardando pareamento ou leitura do QR Code";
    }
  }
  return fallback;
}

function mapEvolutionInstance(item) {
  const instance = item?.instance ?? item;
  const connection = item?.connectionStatus ?? item?.status ?? item?.state ?? instance?.status ?? null;
  return {
    instanceName: instance?.instanceName ?? instance?.name ?? item?.instanceName ?? item?.name ?? "-",
    status: connection == null ? "-" : String(connection),
    number: instance?.ownerJid ?? instance?.number ?? item?.ownerJid ?? item?.number ?? null,
    profileName: instance?.profileName ?? item?.profileName ?? instance?.pushName ?? item?.pushName ?? null,
  };
}

export function createEvolutionClient({ fetchCompat, apiUrl, apiKey }) {
  const baseUrl = getEvolutionBaseUrl(apiUrl);
  const headers = getEvolutionHeaders(apiKey);

  async function fetchEvolutionInstances(instanceName) {
    const paths = ["/instance", "/instance/fetchInstances"];
    let lastErrorMessage = "Falha ao consultar instâncias do manager";

    for (const path of paths) {
      const response = await fetchCompat(`${baseUrl}${path}`, { method: "GET", headers });
      const payload = await parseEvolutionPayload(response);

      if (!response.ok) {
        lastErrorMessage = extractEvolutionMessage(payload, lastErrorMessage);
        if (response.status === 404) continue;
        throw new Error(lastErrorMessage);
      }

      const rowsRaw = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.instances)
          ? payload.instances
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const rows = rowsRaw.map(mapEvolutionInstance);
      if (!instanceName) return rows;
      const target = String(instanceName).toLowerCase();
      return rows.filter((row) => String(row.instanceName || "").toLowerCase() === target);
    }

    throw new Error(lastErrorMessage);
  }

  async function fetchEvolutionConnectionState(instanceName) {
    const response = await fetchCompat(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { method: "GET", headers }
    );
    const payload = await parseEvolutionPayload(response);
    if (!response.ok) {
      throw new Error(extractEvolutionMessage(payload, "Falha ao consultar status da instância"));
    }
    const state = payload?.instance?.state ?? payload?.instance?.status ?? payload?.state ?? payload?.status ?? null;
    return state == null ? null : String(state);
  }

  async function fetchEvolutionInstanceSnapshot(instanceName) {
    const rows = await fetchEvolutionInstances(instanceName);
    const row = rows[0] || { instanceName, status: "-", number: null, profileName: null };

    try {
      const state = await fetchEvolutionConnectionState(instanceName);
      if (state) row.status = state;
    } catch {}

    return row;
  }

  async function setEvolutionInstanceWebhook(instanceName, { url, events, enabled = true, webhook_by_events = false, webhook_base64 = false }) {
    const safeInstance = String(instanceName || "").trim();
    const safeUrl = String(url || "").trim();
    if (!safeInstance) throw new Error("instanceName é obrigatório para configurar webhook");
    if (!safeUrl) throw new Error("url é obrigatório para configurar webhook");

    const body = {
      enabled: Boolean(enabled),
      url: safeUrl,
      webhook_by_events: Boolean(webhook_by_events),
      webhook_base64: Boolean(webhook_base64),
      events: Array.isArray(events) ? events : [],
    };

    const paths = [
      `/webhook/instance/${encodeURIComponent(safeInstance)}`,
      `/webhook/set/${encodeURIComponent(safeInstance)}`,
      `/webhook/instance`,
    ];

    let lastMessage = "Falha ao configurar webhook da instância";
    for (const path of paths) {
      const response = await fetchCompat(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const payload = await parseEvolutionPayload(response);
      if (response.ok) return payload;
      lastMessage = extractEvolutionMessage(payload, lastMessage);
      if (response.status === 404) continue;
    }
    throw new Error(lastMessage);
  }

  return {
    fetchEvolutionInstances,
    fetchEvolutionConnectionState,
    fetchEvolutionInstanceSnapshot,
    setEvolutionInstanceWebhook,
    parseEvolutionPayload,
    headers,
    baseUrl,
  };
}
