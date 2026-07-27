import express from "express";
import oracledb from "oracledb";
import { Pool } from "pg";
import cors from "cors";
import dotenv from "dotenv";
import registerAssumirSeparacaoPedido from "./apis/gestlog/assumirSeparacaoPedido.js";
import registerCancelarSeparacaoPedido from "./apis/gestlog/cancelarSeparacaoPedido.js";
import registerEnviarPedidoColeta from "./apis/gestlog/enviarPedidoColeta.js";
import registerEnviarPedidoMessejana from "./apis/gestlog/enviarPedidoMessejana.js";
import registerConfirmarCortePedido from "./apis/gestlog/confirmarCortePedido.js";
import registerConfirmarSeparacaoItemPedido from "./apis/gestlog/confirmarSeparacaoItemPedido.js";
import registerConfirmarSeparacaoPedido from "./apis/gestlog/confirmarSeparacaoPedido.js";
import registerPedidosSeparador from "./apis/gestlog/pedidosSeparador.js";
import registerLoginAppGestLOG from "./apis/gestlog/loginAppGestLOG.js";
import registerInserirProdutoSemGtin from "./apis/gestlog/inserirProdutoSemGtin.js";
import registerPesquisarProduto from "./apis/gestlog/pesquisarProduto.js";
import registerBuscarProdutosSemGtin from "./apis/gestlog/buscarProdutosSemGtin.js";
import registerExcluirProdutoSemGtin from "./apis/gestlog/excluirProdutoSemGtin.js";
import registerGerirPermissoesUsuario from "./apis/gestlog/gerirPermissoesUsuario.js";

dotenv.config({ path: "/home/multgesti/.env" });
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = 7009;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let pgPool = null;
function getPgPool() {
  if (pgPool) return pgPool;

  const connectionString = String(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();
  const hasSplitConfig = Boolean(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER);
  if (!connectionString && !hasSplitConfig) return null;

  const sslEnabled = String(process.env.PGSSL ?? "").trim().toLowerCase() === "true";
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;

  pgPool = new Pool(
    connectionString
      ? { connectionString, ssl }
      : {
          host: String(process.env.PGHOST ?? "").trim(),
          port: Number(process.env.PGPORT ?? 5432),
          database: String(process.env.PGDATABASE ?? "").trim(),
          user: String(process.env.PGUSER ?? "").trim(),
          password: String(process.env.PGPASSWORD ?? "").trim(),
          ssl,
        }
  );

  return pgPool;
}

const router = express.Router();
registerLoginAppGestLOG(router, { oracledb });
registerPedidosSeparador(router, { oracledb });
registerAssumirSeparacaoPedido(router, { oracledb });
registerConfirmarSeparacaoPedido(router, { oracledb });
registerConfirmarSeparacaoItemPedido(router, { oracledb });
registerConfirmarCortePedido(router, { oracledb });
registerCancelarSeparacaoPedido(router, { oracledb });
registerEnviarPedidoColeta(router, { oracledb });
registerEnviarPedidoMessejana(router, { oracledb });
registerInserirProdutoSemGtin(router, { oracledb });
registerPesquisarProduto(router, { oracledb });
registerBuscarProdutosSemGtin(router, { oracledb });
registerExcluirProdutoSemGtin(router, { oracledb });
registerGerirPermissoesUsuario(router, { oracledb });

router.get("/postgres/ping", async (_req, res) => {
  const pool = getPgPool();
  if (!pool) {
    return res.status(500).json({
      ok: false,
      message: "Postgres não configurado. Defina POSTGRES_URL (ou DATABASE_URL) ou PGHOST/PGDATABASE/PGUSER.",
    });
  }

  try {
    const result = await pool.query("SELECT 1 AS ok");
    return res.json({ ok: true, db: "postgres", rows: result.rows });
  } catch (err) {
    return res.status(503).json({ ok: false, db: "postgres", message: "Falha ao conectar no Postgres", detalhe: err?.message ?? String(err) });
  }
});
app.use("/apis/gestlog", router);

app.listen(PORT, () => {
  console.log(`Servidor appGestLOG rodando na porta ${PORT}`);
});
