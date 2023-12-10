import { Router } from "express";
import { trial } from "../controllers/trial.controller.js";

const router = Router();

router.route("/trial-section").get(trial)

export default router;
