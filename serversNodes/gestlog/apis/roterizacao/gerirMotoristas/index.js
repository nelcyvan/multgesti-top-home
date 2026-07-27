import express from "express";
import motoristasRouter from "./endpoints/motoristas.js";

const router = express.Router();

router.use(motoristasRouter);

export default router;
