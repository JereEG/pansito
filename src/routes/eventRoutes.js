import express from "express";
import eventController from "../controllers/eventController.js";

const router = express.Router();

router.post("/api/agendar", eventController.agendarClase);

export default router;
