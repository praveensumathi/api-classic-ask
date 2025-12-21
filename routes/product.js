var express = require("express");
const productController = require("../controllers/api/productController");
const adminProductController = require("../controllers/admin/productController");
var router = express.Router();
const { uploadByMulterS3 } = require("../config/s3Config");
const { useAuth, useAdminAuth } = require("../middleware/middleware");
const multer = require("multer");
const upload = multer();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

//User
router.post("/checkValidation", use(productController.checkValidation));
router.get(
  "/fetchProductsByCategory/:categoryId",
  use(productController.fetchProductsByCategory)
);
router.get(
  "/fetchProductByID/:productId",
  use(productController.fetchProductByID)
);
router.get("/getSizesById/:productId", use(productController.getSizesById));
router.get("/searchProduct", use(productController.searchProduct));
router.get(
  "/getNewArrivalProducts",
  use(productController.getNewArrivalProducts)
);

//Admin
router.get("/getAllProducts", use(adminProductController.getAllProducts));
router.post(
  "/createProduct",
  [upload.any(), useAdminAuth],
  use(adminProductController.createProduct)
);
router.put(
  "/updateProduct/:productId",
  [upload.any(), useAdminAuth],
  use(adminProductController.updateProduct)
);
router.delete(
  "/deleteProduct/:productId",
  use(adminProductController.deleteProduct)
);

router.post(
  "/bulkupload",
  useAdminAuth,
  use(adminProductController.bulkupload)
);
router.post(
  "/productBulkDelete",
  useAdminAuth,
  use(adminProductController.productBulkDelete)
);
router.get("/resolveFilePath", use(adminProductController.resolveFilePath));

router.delete(
  "/deleteOutOfStock",
  useAdminAuth,
  use(adminProductController.deleteOutOfStock)
);
router.get(
  "/fetchProductByProductCode/:productCode",
  useAdminAuth,
  use(adminProductController.fetchProductByProductCode)
);

router.get(
  "/getPurchaseProductReportByDateWise/:fromDate/:toDate",
  useAdminAuth,
  use(adminProductController.getPurchaseProductReportByDateWise)
);

router.get(
  "/getProductInstockReportByDateWise/:fromDate/:toDate",
  useAdminAuth,
  use(adminProductController.getProductInstockReportByDateWise)
);

//router.delete("/deleteS3Image", use(adminProductController.deleteS3Image));

module.exports = router;
