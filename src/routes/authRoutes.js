import express from "express";
import authController from "../controllers/authController.js";

const router = express.Router();

router.get("/auth", authController.redirectToGoogle);
router.get("/auth/callback", authController.googleCallback);

export default router;
