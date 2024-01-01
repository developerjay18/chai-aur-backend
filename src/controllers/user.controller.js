import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// refresh and access token generator
const generateAccessAndRefreshToken = async (userID) => {
  try {
    const user = User.findById(userID);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "something went wrong while creating tokens");
  }
};

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

// -->
// take data from user
// check if empty or not
// find user by entered data
// check password
// generate access and refresh token
// send cookie

const loginUser = asyncHandler(async (req, res) => {
  // take data from user
  const { email, username, password } = req.body;

  // check if empty or not
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  // find user by entered data
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError("404", "User not found or doesnot exist");
  }

  // check password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError("401", "Invalid user credentials");
  }

  // generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggesInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggesInUser, accessToken, refreshToken },
        "user loggedI successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

export { registerUser, loginUser, logoutUser };
