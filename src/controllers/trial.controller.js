import { asyncHandler } from "../utils/asyncHandler.js";

const trial = asyncHandler(async (req, res) => {
  console.log("occuring");
  res.status(200).json({
    message: "ok",
  });
});

export { trial };
