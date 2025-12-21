const { ACCESS_TOKEN_NAME } = require("../constants/Constants");
const { validateAccessToken } = require("../utils/utils");

const useAuth = async (req, res, next) => {
  const token = req.cookies[ACCESS_TOKEN_NAME];

  try {
    if (!token) {
      const error = new Error("token not found");
      error.statusCode = 401;
      throw error;
    }

    // Check if the access token is valid
    const payload = await validateAccessToken(token);
    if (payload) {
      return next();
    }
  } catch (error) {
    if (error && error.name && error.name == "TokenExpiredError") {
      res.clearCookie(ACCESS_TOKEN_NAME);
      const error = new Error(error.message);
      error.statusCode = 401;
      next(error);
    } else {
      next(error);
    }
  }
};

module.exports = { useAuth };
