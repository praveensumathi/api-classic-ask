var express = require("express");
const orderController = require("../controllers/api/orderController");
const adminOrderController = require("../controllers/admin/ordersController");
const { useAuth } = require("../middleware/middleware");
const {
  uploadByMulterS3,
  uploadByMulterS3AsAttachement,
} = require("../config/s3Config");

var router = express.Router();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/createNewOrder", use(orderController.createNewOrder));
router.get(
  "/getOrdersByUserId",
  useAuth,
  use(orderController.getOrdersByUserId)
);
router.get(
  "/getAllOrders/:status",
  useAuth,
  use(adminOrderController.getAllOrders)
);

router.put(
  "/updateOrderStatus/:orderId",
  [useAuth, uploadByMulterS3AsAttachement.single("acceptOrderImage")],
  use(adminOrderController.updateOrderStatus)
);
router.get(
  "/getAllOnlineOrdersForGstByDateWise/:fromDate/:toDate",
  useAuth,
  use(adminOrderController.getAllOnlineOrdersForGstByDateWise)
);

router.get(
  "/getOrderDetailById/:id",
  useAuth,
  use(adminOrderController.getOrderbyOrderId)
);

router.get(
  "/getOnlineSellingReport/:fromDate/:toDate",
  useAuth,
  use(adminOrderController.getOnlineSellingReport)
);

router.get(
  "/generateOrderNumberAPI",
  use(orderController.generateOrderNumberAPI)
);

module.exports = router;
