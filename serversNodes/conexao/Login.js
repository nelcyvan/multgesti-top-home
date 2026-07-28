// home/multgesti/serversNodes/conexao/Login.js
import express from "express";
import oracledb from "oracledb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Carrega o .env na raiz do projeto (multgesti-top-home/.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Inicializa o Oracle Client
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = Number(process.env.CONEXAO_PORT);
if (!PORT) {
  console.error("[Conexao] Porta não configurada em CONEXAO_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT decrypt(senhabd, usuariobd) AS senha,
              nome,
              nome_guerra,
              matricula,
              codfilial
       FROM pcempr
       WHERE nome_guerra = :usuario`,
      [usuario.toUpperCase()],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userDB = result.rows[0];

    if (userDB.SENHA !== senha.toUpperCase()) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    // Busca CODUSUR associado ao usuário para uso nas permissões
    let codusur = null;
    try {
      const codRes = await conn.execute(
        `SELECT CODUSUR FROM PCUSUARI WHERE NOME_GUERRA = :usuario`,
        [userDB.NOME_GUERRA],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (codRes.rows && codRes.rows.length > 0) {
        codusur = codRes.rows[0].CODUSUR;
      }
    } catch (e) {
      console.error("Falha ao buscar CODUSUR:", e);
    }

    res.json({
      message: "Login realizado com sucesso",
      nome: userDB.NOME,
      usuario: userDB.NOME_GUERRA,
      matricula: userDB.MATRICULA,
      codfilial: userDB.CODFILIAL,
      codusur: codusur,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

app.post("/api/gestlog/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;

  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT CODUSUR,
              DT_ULT_ACESSO,
              HR_ULT_ACESSO,
              PERMISSAO_TELA_ZAPHUB,
              PERMISSAO_TELA_GESTPRO,
              PERMISSAO_TELA_OFXCONCILIA,
              PERMISSAO_TELA_GESTLOG
         FROM MULTGESTI_PERMISSOES
        WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const perm = result.rows[0];
    const permitido = String(perm.PERMISSAO_TELA_GESTLOG || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({
        permitido: false,
        message: "Usuário sem permissão para GestLOG",
      });
    }

    return res.json({
      permitido: true,
      message: "Permissão validada com sucesso para GestLOG",
      detalhes: {
        codusur: perm.CODUSUR,
        dtUltAcesso: perm.DT_ULT_ACESSO,
        hrUltAcesso: perm.HR_ULT_ACESSO,
      },
    });
  } catch (err) {
    console.error("Erro na validação de permissão GestLOG:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

app.post("/api/zaphub/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;
  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_ZAPHUB FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_ZAPHUB || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para ZapHub" });
    }

    res.json({ permitido: true, message: "Permissão validada com sucesso para ZapHub" });
  } catch (err) {
    console.error("Erro na permissão ZapHub:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.get("/api/zaphub/usuarios", async (req, res) => {
  const q = String(req.query?.q ?? "").trim();
  const limit = Math.max(1, Math.min(80, Number(req.query?.limit ?? 30) || 30));

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const binds = { limit };
    let where = `WHERE MOTIVOINATIVACAO IS NULL`;
    if (q) {
      binds.qLike = `%${q.toUpperCase()}%`;
      binds.qMatLike = `%${q}%`;
      where += ` AND (UPPER(NOME) LIKE :qLike OR TO_CHAR(MATRICULA) LIKE :qMatLike OR UPPER(AREAATUACAO) LIKE :qLike OR UPPER(FUNCAO) LIKE :qLike)`;
    }

    const sql = `
      SELECT *
      FROM (
        SELECT
          MATRICULA,
          NOME,
          AREAATUACAO,
          FUNCAO
        FROM PCEMPR
        ${where}
        ORDER BY MATRICULA
      )
      WHERE ROWNUM <= :limit
    `;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = (result.rows || []).map((row) => ({
      matricula: row.MATRICULA,
      nome: row.NOME,
      areaAtuacao: row.AREAATUACAO || null,
      funcao: row.FUNCAO || null,
    }));
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao pesquisar usuários do ZapHub:", err);
    return res.status(500).json({ message: "Erro interno ao pesquisar usuários", detalhe: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

app.post("/api/gestpro/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;
  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_GESTPRO FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_GESTPRO || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para GestPRO" });
    }

    res.json({ permitido: true, message: "Permissão validada com sucesso para GestPRO" });
  } catch (err) {
    console.error("Erro na permissão GestPRO:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

// Permissão GestMKT
app.post("/api/gestmkt/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;
  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_GESTMKT FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_GESTMKT || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para GestMKT" });
    }

    res.json({ permitido: true, message: "Permissão validada com sucesso para GestMKT" });
  } catch (err) {
    console.error("Erro na permissão GestMKT:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/ofxconcilia/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;
  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_OFXCONCILIA FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_OFXCONCILIA || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para OFX-Concilia" });
    }

    res.json({ permitido: true, message: "Permissão validada com sucesso para OFX-Concilia" });
  } catch (err) {
    console.error("Erro na permissão OFX-Concilia:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestfin/permissao", async (req, res) => {
  const { codigoUsuario } = req.body;
  if (!codigoUsuario) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_GESTFIN FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      [Number(codigoUsuario)],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_GESTFIN || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para GestFIN" });
    }

    res.json({ permitido: true, message: "Permissão validada com sucesso para GestFIN" });
  } catch (err) {
    console.error("Erro na permissão GestFIN:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de login rodando na porta ${PORT}`);
});
