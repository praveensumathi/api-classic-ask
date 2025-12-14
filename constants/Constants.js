const SECRET_KEY = "CVHQDs848v";
const ACCESS_TOKEN = "nks_access_token";
const ExpirationInMilliSeconds = 172800000; //2 days

const PRODUCT_IMAGES_FIELDNAME = "images";
const PRODUCT_POSTER_IMAGE = "posterImage";

const PRODUCTCODE = "C-ASK";

const Roles = {
  ADMIN: "admin",
  CUSTOMER: "customer",
  SUPER_CUSTOMER:'superCustomer',
  SHOP: "shop",
};

module.exports = {
  SECRET_KEY,
  ACCESS_TOKEN,
  ExpirationInMilliSeconds,
  PRODUCT_IMAGES_FIELDNAME,
  PRODUCT_POSTER_IMAGE,
  PRODUCTCODE,
  Roles,
};
