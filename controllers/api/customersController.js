/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const UserModel = require("../../database/models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const {
  SECRET_KEY,
  ACCESS_TOKEN_NAME,
  ExpirationInMilliSeconds,
  Roles,
} = require("../../constants/Constants");
const { validateAccessToken } = require("../../utils/utils");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.login = async (req, res, next) => {
  let { phoneNumber, password, role } = req.body;

  if (phoneNumber === "" || password === "") {
    const error = new Error("Empty credentials supplied");
    error.statusCode = 454;
    throw error;
  } else {
    try {
      var user = null;

      if (role) {
        user = await UserModel.findOne({ phoneNumber, role });
      } else {
        user = await UserModel.findOne({ phoneNumber, role: Roles.CUSTOMER });
      }

      if (!user) {
        const error = new Error("User Not Available Please Signup to continue");
        error.statusCode = 401;
        throw error;
      }

      if (user.role !== Roles.CUSTOMER && user.role !== Roles.SUPER_CUSTOMER) {
        const error = new Error(
          "Invalid credentials entered! or your role is not eligible"
        );
        error.statusCode = 500;
        throw error;
      }

      // const isPasswordValid = await bcrypt.compare(password, user.password);
      // if (!isPasswordValid) {
      //   const error = new Error("Invalid credentials entered!");
      //   error.statusCode = 400;
      //   throw error;
      // }

      var userObj = {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isReseller: user.isReseller,
        role: user.role,
        address: user.address,
      };

      const token = jwt.sign(userObj, SECRET_KEY);

      res.cookie(ACCESS_TOKEN_NAME, token, {
        httpOnly: true,
        maxAge: ExpirationInMilliSeconds, //2 days
      });

      res.status(200).json({
        message: "Signin successful",
        data: userObj,
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.signup = async (req, res, next) => {
  let { name, phoneNumber, email, password, role } = req.body;

  role = Roles.CUSTOMER;
  email = "";

  try {
    // Check if the user already exists
    const existingUser = await UserModel.findOne({ phoneNumber });
    if (existingUser && existingUser.role === role) {
      const error = new Error(
        "User Already exists on this Phone number, Please do Login"
      );
      error.statusCode = 409;
      throw error;
    } else {
      const salt = 10;
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = new UserModel({
        name,
        phoneNumber,
        email,
        password: hashedPassword,
        role,
      });
      const savedUser = await newUser.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: savedUser._id,
          phoneNumber: savedUser.phoneNumber,
          name: savedUser.name,
          role: savedUser.role,
        },
        SECRET_KEY
      );

      res
        .cookie(ACCESS_TOKEN_NAME, token, {
          httpOnly: true,
          maxAge: ExpirationInMilliSeconds, //2days
        })
        .status(200)
        .json({
          message: "Signup Successful",
          data: {
            userId: savedUser._id,
            phoneNumber: savedUser.phoneNumber,
            name: savedUser.name,
            role: savedUser.role,
            address: savedUser.address,
          },
        });
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.generateResetLink = async (req, res, next) => {
  try {
    // Get the phone number from the request body
    const { phoneNumber } = req.body;

    // Check if the user with the provided phone number exists
    const existingUser = await UserModel.findOne({ phoneNumber });
    if (!existingUser) {
      const error = new Error(
        "Invalid User with provided phone number does not exist entered!"
      );
      error.statusCode = 404;
      throw error;
    }

    // Generate a unique password reset token
    const resetToken = await generateResetToken();

    console.log(resetToken);
    // Hash the reset token using bcrypt
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // // Store the hashed reset token and its associated phone number in your database or cache
    existingUser.resetToken = hashedToken;
    await existingUser.save();

    // Construct the custom reset link with the phone number included
    const resetLink = `/reset-password?phoneNumber=${encodeURIComponent(
      phoneNumber
    )}&token=${encodeURIComponent(resetToken)}`;

    // Return the reset link to the client
    res.json({ resetLink });
  } catch (error) {
    next(error);
  }
};

function generateResetToken() {
  return new Promise((resolve, reject) => {
    randomBytes(16, (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer.toString("hex"));
      }
    });
  });
}

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.resetPassword = async (req, res, next) => {
  try {
    // Get the phone number and reset token from the request query parameters
    const { phoneNumber, token, newPassword } = req.query;

    // Find the user with the provided phone number
    const user = await UserModel.findOne({ phoneNumber });
    if (!user) {
      const error = new Error("User with provided phone number does not exist");
      error.statusCode = 422;
      throw error;
    }

    if (user.resetToken) {
      var isEqual = await bcrypt.compare(token, user.resetToken);

      if (!isEqual) {
        const error = new Error("Reset link has already been used");
        error.statusCode = 410;
        throw error;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password and reset token in the UserModel
      user.password = hashedPassword;
      user.resetToken = null;

      // Save the updated user in the database
      await user.save();
      res.json({
        status: "SUCCESS",
        message: "Password reset successful",
      });
    } else {
      const error = new Error("Reset token is not valid");
      error.statusCode = 403;
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

function generateResetToken() {
  return new Promise((resolve, reject) => {
    randomBytes(16, (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer.toString("hex"));
      }
    });
  });
}

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.logout = async (req, res) => {
  res.clearCookie(ACCESS_TOKEN_NAME);
  res.status(200).json({
    status: true,
    message: "Logged out successfully",
    data: null,
  });
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.isAuthorized = async (req, res) => {
  const token = req.cookies[ACCESS_TOKEN_NAME];

  if (token) {
    // Check if the access token is valid
    const payload = await validateAccessToken(token);
    if (payload) {
      res.json(payload);
    } else {
      res.json(null);
    }
  } else {
    res.json(null);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getUserByUserId = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await UserModel.findById(userId).select(
      "name phoneNumber email"
    );

    if (!user) {
      const error = new Error("user not found");
      error.statusCode = 404;
      throw error;
    }
    return res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { name, email } = req.body;

    const updateUserProfile = await UserModel.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true }
    );

    res.json(updateUserProfile);
  } catch (error) {
    error = new Error("Error while update user profile status");
    error.statusCode = 500;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.updateUserAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { address, pincode, district, state } = req.body;

    // Validate request body
    if (!address || !pincode || !district || !state) {
      return res.status(400).json({
        message: "All address fields are required",
      });
    }

    // Update only, no return
    const result = await UserModel.updateOne(
      { _id: userId, role: Roles.CUSTOMER },
      {
        $set: {
          address: {
            address,
            pincode,
            district,
            state,
          },
        },
      },
      { runValidators: true }
    );

    // Check if user exists
    if (result.matchedCount === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).send();
  } catch (error) {
    console.error("Update address error:", error);
    error.statusCode = 500;
    next(error);
  }
};
