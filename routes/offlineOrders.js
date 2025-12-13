var express = require("express");
const adminOfflineOrderController = require("../controllers/admin/offlineOrderController");
const { useAuth } = require("../middleware/middleware");

var router = express.Router();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  "/createOfflineOrder",
  useAuth,
  use(adminOfflineOrderController.createOfflineOrder)
);

router.get(
  "/getOfflineOrdersReportByDateWise/:fromDate/:toDate",
  useAuth,
  use(adminOfflineOrderController.getOfflineOrdersReportByDateWise)
);
router.get(
  "/getOfflineOrdersForGstByDateWise/:fromDate/:toDate",
  useAuth,
  use(adminOfflineOrderController.getOfflineOrdersForGstByDateWise)
);

router.put(
  "/updateOfflineOrder/:orderId",
  useAuth,
  adminOfflineOrderController.updateOfflineOrder
);
router.get(
  "/getOfflineOrdersByOrderNumber/:orderNumber",
  useAuth,
  use(adminOfflineOrderController.getOfflineOrdersByOrderNumber)
);

router.get(
  "/getAllOfflineOrders",
  useAuth,
  adminOfflineOrderController.getAllOfflineOrders
);

module.exports = router;
