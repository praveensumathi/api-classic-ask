/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const Razorpay = require("razorpay");
var crypto = require("crypto");
const axios = require("axios");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount provided");
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET_KEY,
    });

    const options = {
      amount: amount, // Convert to paise and ensure it's an integer
      currency: "INR",
      receipt: crypto.randomBytes(10).toString("hex"),
    };

    const order = await instance.orders.create(options);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        //key: process.env.RAZORPAY_KEY_ID // Frontend needs this for payment processing
      },
      message: "Razorpay order created successfully",
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    error = new Error("Error while creating payment order");
    error.statusCode = 500;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing required payment verification parameters");
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      return res.json({
        success: true,
        data: {
          razorpay_order_id,
          razorpay_payment_id,
          verified: true,
        },
        message: "Payment verified successfully",
      });
    } else {
      throw new Error("Invalid signature sent!");
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    error = new Error("Payment verification failed");
    error.statusCode = 400;
    next(error);
  }
};
