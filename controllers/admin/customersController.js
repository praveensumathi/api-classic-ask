const UserModel = require("../../database/models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const {
  SECRET_KEY,
  ACCESS_TOKEN,
  ExpirationInMilliSeconds,
  Roles,
} = require("../../constants/Constants");

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllCustomers = async (req, res, next) => {
  try {
    const { name, phoneNumber } = req.query;

    let query = {};

    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    if (phoneNumber) {
      query.phoneNumber = { $regex: phoneNumber, $options: "i" };
    }

    let customerDocs;

    if (Object.keys(query).length === 0) {
      customerDocs = await UserModel.find({});
    } else {
      customerDocs = await UserModel.find(query);
    }

    const filteredCustomers = customerDocs.filter((customer) => {
      return customer.role === "customer";
    });

    var response = {
      customers: filteredCustomers,
      total: filteredCustomers.length,
    };

    res.json(response);
  } catch (error) {
    error = new Error("An error occurred");
    error.statusCode = 500;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedcustomer = await UserModel.deleteOne({ _id: id });

    res.json(deletedcustomer);
  } catch (error) {
    error = new Error("unable to Delete Customer");
    error.statusCode = 514;
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
      const error = new Error("User with provided phone number does not exist");
      error.statusCode = 515;
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
    const resetLink = `/resetPassword?phoneNumber=${encodeURIComponent(
      phoneNumber
    )}&token=${encodeURIComponent(resetToken)}`;

    // Return the reset link to the client
    res.json(resetLink);
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.resetPassword = async (req, res, next) => {
  try {
    // Get the phone number and reset token from the request query parameters
    const { phoneNumber, token, newPassword } = req.body;
    console.log(req.query);

    // Find the user with the provided phone number
    const user = await UserModel.findOne({ phoneNumber });
    if (!user) {
      const error = new Error("User with provided phone number does not exist");
      error.statusCode = 516;
      throw error;
    }

    if (user.resetToken) {
      var isEqual = await bcrypt.compare(token, user.resetToken);

      if (!isEqual) {
        const error = new Error("Reset link has already been used");
        error.statusCode = 517;
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
      error.statusCode = 518;
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
exports.adminLogin = async (req, res, next) => {
  let { phoneNumber, password } = req.body;

  if (phoneNumber === "" || password === "") {
    const error = new Error("Empty credentials supplied");
    error.statusCode = 454;
    throw error;
  } else {
    try {
      const user = await UserModel.findOne({
        phoneNumber,
        $or: [{ role: Roles.ADMIN }, { role: Roles.SHOP }],
      });
      if (!user) {
        const error = new Error("User Not Available Please Signup to continue");
        error.statusCode = 401;
        throw error;
      }

      if (user.role === Roles.CUSTOMER) {
        const error = new Error(
          "Invalid credentials entered! or your role is not allowed"
        );
        error.statusCode = 500;
        throw error;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        const error = new Error("Invalid credentials entered!");
        error.statusCode = 400;
        throw error;
      }

      var userObj = {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        role: user.role,
      };

      const token = jwt.sign(userObj, SECRET_KEY);

      res.cookie(ACCESS_TOKEN, token, {
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
exports.isAuthorized = async (req, res) => {
  const { nks_access_token } = req.cookies;

  if (nks_access_token) {
    // Check if the access token is valid
    const payload = await validateAccessToken(nks_access_token);
    if (payload) {
      res.json(payload);
    } else {
      res.json(null);
    }
  } else {
    res.json(null);
  }
};

async function validateAccessToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const { userId } = decoded;

    // Check if the userId exists in the UserModel database
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

exports.makeCustomerAsReseller = async (req, res) => {
  try {
    const userIdToUpdate = req.params.userId;
    const { isReseller } = req.body;

    const updatedReseller = await UserModel.findByIdAndUpdate(
      userIdToUpdate,
      { isReseller },
      { new: true }
    );
    if (!updatedReseller) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found" });
    }
    res.json(updatedReseller);
  } catch (error) {
    console.error(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.createAdmin = async (req, res, next) => {
  let { name, phoneNumber, email = "", password } = req.body;
  var adminRole = "admin";

  try {
    // Check if the user already exists
    const existingUser = await UserModel.findOne({ phoneNumber });
    if (existingUser && existingUser.role === adminRole) {
      const error = new Error(
        "Invalid User with provided phonenumber already exists entered!"
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
        role:adminRole,
      });
      const savedUser = await newUser.save();
      // Generate JWT token
      const token = jwt.sign(
        {
          userId: savedUser._id,
          phoneNumber: savedUser.phoneNumber,
          name: savedUser.name,
          role:adminRole
        },
        SECRET_KEY
      );

      res
        .cookie(ACCESS_TOKEN, token, {
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
            role : savedUser.role
          },
        });
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
};
