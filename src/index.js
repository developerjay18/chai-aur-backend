import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config();

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`SERVER RUNNING: ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log(`DB CONNECTION AND APP BUILDING ERROR: ${err}`);
  });