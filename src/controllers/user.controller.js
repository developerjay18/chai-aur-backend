import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// refresh and access token generator
const generateAccessAndRefreshToken = async (userID) => {
  try {
    // yaha mai await lagana bhul gaya tha .. 👦
    const user = await User.findById(userID);

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

const refreshAccessToken = asyncHandler(async (req, res) => {
  // fetching stored token
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  // checking token fetched or not
  if (!refreshToken) {
    throw new ApiError(401, "unauthorized token");
  }

  // decoding token using jwt.verify()
  const decodedRefreshToken = jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  // finding user based on the decoded token
  const user = await User.findById(decodedRefreshToken._id);

  // checking if user found or not
  if (!user) {
    throw new ApiError("404", "user not found");
  }

  // comparing both jwt tokens
  if (refreshToken !== user.refreshToken) {
    throw new ApiError(400, "tokens didn't match with each other");
  }

  // securingmy cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  // generating new access and refresh tokens
  const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // returning response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed"
      )
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordTrue = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordTrue) {
    throw new ApiError("401", "old Password is not correct");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fecthed successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // fullname , email
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError("401", "username or email is required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "user acount details updated"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const localAvatarPath = req.file?.path;

  if (!localAvatarPath) {
    throw new ApiError("400", "local Image not found please upload again");
  }

  const uploadedAvatar = await uploadOnCloudinary(localAvatarPath);

  if (!uploadedAvatar.url) {
    throw new ApiError("401", "Error occured while upload on cloudiinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: uploadedAvatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const localCoverImgPath = req.file?.path;

  if (!localCoverImgPath) {
    throw new ApiError("400", "local Image not found please upload again");
  }

  const uploadedCoverImg = await uploadOnCloudinary(localCoverImgPath);

  if (!uploadedCoverImg.url) {
    throw new ApiError("401", "Error occured while upload on cloudiinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: uploadedCoverImg.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username.trim()) {
    throw new ApiError("404", "username not found or may be missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignFeild: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError("404", "channel not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updateAccountDetails,
  updateUserAvatar,
  getCurrentUser,
  getCurrentUser,
  changeCurrentPassword,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
