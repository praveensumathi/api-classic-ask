var express = require("express");
var router = express.Router();
const paymentController = require("../controllers/api/paymentController");

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/createRazorpayOrder", use(paymentController.createRazorpayOrder));
router.post("/verifyRazorpayPayment", use(paymentController.verifyRazorpayPayment));

module.exports = router;
