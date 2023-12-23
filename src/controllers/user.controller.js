import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// -->
// get all data from user
// validate data - no empty
// check if user already exsist - username || email
// get all files from user and upload to multer and take local path // -----
// upload file to cloudinary and check
// create a user object and do DB entry
// remove password and refresh token from response
// check user is created or not
// return response

const registerUser = asyncHandler(async (req, res) => {
  // get all data from user
  const { username, email, fullName, password } = req.body;

  // validate data - no empty
  if (
    [username, email, fullName, password].some((item) => item.trim() === "")
  ) {
    throw new ApiError(400, "Feilds can't be empty");
  }

  // check if user already exsist - username || email
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });

  if (existedUser) {
    throw new ApiError(409, "user already created with same username or email");
  }

  // get all files from user and upload to multer and take local path
  const localAvatarPath = req.files?.avatar[0]?.path;
  const localCoverImagePath = req.files?.coverImage[0]?.path;

  if (!localAvatarPath) {
    throw new ApiError(400, "avatar file required");
  }

  // upload file to cloudinary and check
  let avatar = await uploadOnCloudinary(localAvatarPath);
  let coverImage = await uploadOnCloudinary(localCoverImagePath);

  if (!avatar) {
    throw new ApiError(500, "server error. plz try again");
  }

  // create a user object and do DB entry
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    password,
    username: username.toLowerCase(),
    coverImage: coverImage?.url || "",
    email,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "server error : please try again");
  }

  // return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user created sucessfully"));
});

export { registerUser };
