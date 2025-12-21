var express = require("express");
var router = express.Router();

const categoryController = require("../controllers/api/categoryController");
const categoryControlleradmin = require("../controllers/admin/categoryController");
const { uploadByMulterS3 } = require("../config/s3Config");
const { useAuth, useAdminAuth } = require("../middleware/middleware");

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

//api controller
router.get(
  "/getAllProductsByCategory",
  use(categoryController.getAllProductsByCategory)
);
router.get(
  "/fetchProductsByCategory/:categoryId",
  use(categoryController.fetchProductsByCategory)
);
router.get("/fetchCategory", use(categoryController.fetchCategory));

// admin controller
router.get(
  "/getAllCategory",
  useAdminAuth,
  use(categoryControlleradmin.getAllCategory)
);
router.post(
  "/createCategory",
  [useAdminAuth, uploadByMulterS3.single("categoryImage")],
  use(categoryControlleradmin.createCategory)
);
router.put(
  "/updateCategory/:categoryId",
  [useAdminAuth, uploadByMulterS3.single("categoryImage")],
  use(categoryControlleradmin.updateCategory)
);
router.delete(
  "/deleteCategory/:categoryId",
  useAdminAuth,
  use(categoryControlleradmin.deleteCategory)
);
router.get(
  "/fetchProductsByCategoryId/:categoryId",
  useAdminAuth,
  use(categoryControlleradmin.fetchProductsByCategoryId)
);
router.put(
  "/updateCategorySortOrder",
  useAdminAuth,
  use(categoryControlleradmin.updateCategorySortOrder)
);

module.exports = router;
