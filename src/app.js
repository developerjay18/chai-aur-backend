import express from "express";
import cors from "cors";
import { LIMIT } from "./constants.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

// middlewares
app.use(express.json({ limit: LIMIT }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

export default app;
