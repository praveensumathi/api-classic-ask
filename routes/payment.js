var express = require("express");
var router = express.Router();
const paymentController = require("../controllers/api/paymentController");

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/createRazorpayOrder", use(paymentController.createRazorpayOrder));
router.post("/verifyRazorpayPayment", use(paymentController.verifyRazorpayPayment));
router.post("/createPaymentOrder", use(paymentController.createPaymentOrder));
router.post("/verifyPayment", use(paymentController.verifyPayment));
router.post("/phonePePayment", use(paymentController.phonePePayment));
router.get(
  "/phonePeStatusCheckServer/:merchantId/:merchantTransactionId",
  use(paymentController.phonePeStatusCheckServer)
);
router.post(
  "/phonePeStatusCheck/:merchantId/:merchantTransactionId",
  use(paymentController.phonePeStatusCheck)
);
router.post("/phonePeRefund", use(paymentController.phonePeRefund));

module.exports = router;
