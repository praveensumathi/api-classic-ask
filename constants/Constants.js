const SECRET_KEY = process.env.LOGIN_TOKEN_SECRET_KEY;
const ACCESS_TOKEN_NAME = process.env.USER_PORTAL_LOGIN_ACCESS_TOKEN_NAME;
const ADMIN_ACCESS_TOKEN_NAME =
  process.env.ADMIN_PORTAL_LOGIN_ACCESS_TOKEN_NAME;
const ExpirationInMilliSeconds = 172800000; //2 days

const PRODUCT_IMAGES_FIELDNAME = "images";
const PRODUCT_POSTER_IMAGE = "posterImage";

const PRODUCT_CODE = process.env.PRODUCT_CODE;

const Roles = {
  ADMIN: "admin",
  CUSTOMER: "customer",
  SUPER_CUSTOMER: "superCustomer",
  SHOP: "shop",
};

module.exports = {
  SECRET_KEY,
  ACCESS_TOKEN_NAME,
  ADMIN_ACCESS_TOKEN_NAME,
  ExpirationInMilliSeconds,
  PRODUCT_IMAGES_FIELDNAME,
  PRODUCT_POSTER_IMAGE,
  PRODUCT_CODE,
  Roles,
};
