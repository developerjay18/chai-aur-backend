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

// router import
import userRouter from "./routes/user.route.js";
import trailRouter from "./routes/trail.route.js"

// routes declaration
app.use("/api/v1/users", userRouter);

app.get("/",(req,res)=>{
    res.send("hello all")
})

app.use("/trial",trailRouter)

export default app;
