import express from "express";
import criarRotaPost from "./endpoints/criarRotaPost.js";
import excluirRotaDelete from "./endpoints/excluirRotaDelete.js";

const router = express.Router();

router.use(criarRotaPost);
router.use(excluirRotaDelete);

export default router;
