import express from "express";
import oracledb from "oracledb";
import cors from "cors";
import dotenv from "dotenv";
import registerHealthGestPRO from "./apis/gestpro/healthGestPRO.js";
import registerInventarioAvulsoUsuario from "./apis/gestpro/inventarioAvulsoUsuario.js";
import registerInventarioAvulsoProdutos from "./apis/gestpro/inventarioAvulsoProdutos.js";
import registerInventarioAvulsoProduto from "./apis/gestpro/inventarioAvulsoProduto.js";
import registerInventarioAvulsoEncerrar from "./apis/gestpro/inventarioAvulsoEncerrar.js";
import registerInventarioAvulsoCriar from "./apis/gestpro/inventarioAvulsoCriar.js";
import registerProdutoEstoque from "./apis/gestpro/produtoEstoque.js";
import registerProdutoPromocionalEstoque from "./apis/gestpro/produtoPromocionalEstoque.js";
import registerInventarioAvulsoProdutosRegistros from "./apis/gestpro/inventarioAvulsoProdutosRegistros.js";
import registerInventarioAvulsoProdutoExcluirRegistro from "./apis/gestpro/inventarioAvulsoProdutoExcluirRegistro.js";
import registerLoginAppGestPRO from "./apis/gestpro/loginAppGestPRO.js";
import registerVersaoApp from "./apis/gestpro/versaoApp.js";
import registerAuditoriaCriar from "./apis/gestpro/auditoriaCriar.js";
import registerAuditoriaListar from "./apis/gestpro/auditoriaListar.js";
import registerAuditoriaAtualizar from "./apis/gestpro/auditoriaAtualizar.js";
import registerAuditoriaExcluir from "./apis/gestpro/auditoriaExcluir.js";
import registerAuditoriaProduto from "./apis/gestpro/auditoriaProduto.js";
import registerAuditoriaProdutos from "./apis/gestpro/auditoriaProdutos.js";
import registerAuditoriaProdutoAtualizar from "./apis/gestpro/auditoriaProdutoAtualizar.js";
import registerAuditoriaProdutoExcluir from "./apis/gestpro/auditoriaProdutoExcluir.js";
import registerAuditoriaResumoDia from "./apis/gestpro/auditoriaResumoDia.js";

dotenv.config({ path: "/home/multgesti/.env" });
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = 7010;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = express.Router();
registerHealthGestPRO(router);
registerInventarioAvulsoUsuario(router, { oracledb });
registerInventarioAvulsoProdutos(router, { oracledb });
registerInventarioAvulsoProduto(router, { oracledb });
registerInventarioAvulsoEncerrar(router, { oracledb });
registerInventarioAvulsoCriar(router, { oracledb });
registerProdutoEstoque(router, { oracledb });
registerProdutoPromocionalEstoque(router, { oracledb });
registerInventarioAvulsoProdutosRegistros(router, { oracledb });
registerInventarioAvulsoProdutoExcluirRegistro(router, { oracledb });
registerLoginAppGestPRO(router, { oracledb });
registerVersaoApp(router, { oracledb });
registerAuditoriaCriar(router, { oracledb });
registerAuditoriaListar(router, { oracledb });
registerAuditoriaAtualizar(router, { oracledb });
registerAuditoriaExcluir(router, { oracledb });
registerAuditoriaProduto(router, { oracledb });
registerAuditoriaProdutos(router, { oracledb });
registerAuditoriaProdutoAtualizar(router, { oracledb });
registerAuditoriaProdutoExcluir(router, { oracledb });
registerAuditoriaResumoDia(router, { oracledb });
app.use("/apis/gestpro", router);

app.listen(PORT, () => {
  console.log(`Servidor NewAppGestLOG rodando na porta ${PORT}`);
});
