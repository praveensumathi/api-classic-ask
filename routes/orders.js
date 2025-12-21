var express = require("express");
const orderController = require("../controllers/api/orderController");
const adminOrderController = require("../controllers/admin/ordersController");
const { useAuth, useAdminAuth } = require("../middleware/middleware");
const { uploadByMulterS3AsAttachement } = require("../config/s3Config");

var router = express.Router();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

//User
router.post("/createNewOrder", use(orderController.createNewOrder));
router.get(
  "/getOrdersByUserId",
  useAuth,
  use(orderController.getOrdersByUserId)
);
router.get(
  "/generateOrderNumberAPI",
  use(orderController.generateOrderNumberAPI)
);

//Admin
router.get(
  "/getAllOrders/:status",
  useAdminAuth,
  use(adminOrderController.getAllOrders)
);

router.put(
  "/updateOrderStatus/:orderId",
  [useAdminAuth, uploadByMulterS3AsAttachement.single("acceptOrderImage")],
  use(adminOrderController.updateOrderStatus)
);
router.get(
  "/getAllOnlineOrdersForGstByDateWise/:fromDate/:toDate",
  useAdminAuth,
  use(adminOrderController.getAllOnlineOrdersForGstByDateWise)
);

router.get(
  "/getOrderDetailById/:id",
  useAdminAuth,
  use(adminOrderController.getOrderbyOrderId)
);

router.get(
  "/getOnlineSellingReport/:fromDate/:toDate",
  useAdminAuth,
  use(adminOrderController.getOnlineSellingReport)
);

module.exports = router;
