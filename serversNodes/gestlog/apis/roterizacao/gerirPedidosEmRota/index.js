import express from "express";
import getVinculoRouter from "./endpoints/vinculoGet.js";
import inserirPedidoRouter from "./endpoints/inserirPedidoPost.js";

const router = express.Router();

router.use(getVinculoRouter);
router.use(inserirPedidoRouter);

export default router;
