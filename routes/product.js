var express = require("express");
const productController = require("../controllers/api/productController");
const adminProductController = require("../controllers/admin/productController");
var router = express.Router();
const { uploadByMulterS3 } = require("../config/s3Config");
const { useAuth } = require("../middleware/middleware");
const multer = require("multer");
const upload = multer();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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

router.get("/getAllProducts", use(adminProductController.getAllProducts));
router.post(
  "/createProduct",
  [upload.any(), useAuth],
  use(adminProductController.createProduct)
);
router.put(
  "/updateProduct/:productId",
  [upload.any(), useAuth],
  use(adminProductController.updateProduct)
);
router.delete(
  "/deleteProduct/:productId",
  use(adminProductController.deleteProduct)
);

router.post("/bulkupload", useAuth, use(adminProductController.bulkupload));
router.post(
  "/productBulkDelete",
  useAuth,
  use(adminProductController.productBulkDelete)
);
router.get("/resolveFilePath", use(adminProductController.resolveFilePath));

router.delete(
  "/deleteOutOfStock",
  useAuth,
  use(adminProductController.deleteOutOfStock)
);
router.get(
  "/fetchProductByProductCode/:productCode",
  useAuth,
  use(adminProductController.fetchProductByProductCode)
);

router.get(
  "/getPurchaseProductReportByDateWise/:fromDate/:toDate",
  useAuth,
  use(adminProductController.getPurchaseProductReportByDateWise)
);

router.get(
  "/getProductInstockReportByDateWise/:fromDate/:toDate",
  useAuth,
  use(adminProductController.getProductInstockReportByDateWise)
);
module.exports = router;
