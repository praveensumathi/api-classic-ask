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
        key: process.env.RAZORPAY_KEY_ID // Frontend needs this for payment processing
      },
      message: "Razorpay order created successfully"
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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
          verified: true
        },
        message: "Payment verified successfully"
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

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.phonePePayment = async (req, res, next) => {
  try {
    const data = req.body;

    if (!data.userId) {
      throw new Error({ message: "Error while initiate payment" });
    }

    const merchantTransactionId = "MT" + Date.now();

    const phonePeRequestPayload = {
      merchantId: process.env.PHONEPE_MERCHANTID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: "MUID" + data.userId,
      amount: data.amount * 100,
      redirectUrl:
        process.env.WEBAPP_URL +
        `#/payment-processing/${process.env.PHONEPE_MERCHANTID}/${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      // callbackUrl:
      //   process.env.APP_URL +
      //   `payment/phonePeStatusCheckServer/${process.env.PHONEPE_MERCHANTID}/${merchantTransactionId}`,
      mobileNumber: data.mobileNumber,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const base64Payload = Buffer.from(
      JSON.stringify(phonePeRequestPayload)
    ).toString("base64");

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = 1;

    const shaPayload = base64Payload + "/pg/v1/pay" + saltKey;
    const sha256 = crypto.createHash("sha256").update(shaPayload).digest("hex");

    //SHA256(Base64 encoded payload + “/pg/v1/pay” + salt key) + ### + salt index
    const checksum = sha256 + "###" + saltIndex;

    const options = {
      method: "POST",
      url: process.env.PHONEPE_BASE_URL + process.env.PHONEPE_PAY_URL,
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      data: {
        request: base64Payload,
      },
    };

    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.phonePeStatusCheckServer = async (req, res) => {
  try {
    const PAYMENT_SUCCESS = "PAYMENT_SUCCESS";
    const PAYMENT_DECLINED = "PAYMENT_DECLINED";
    const PAYMENT_ERROR = "PAYMENT_ERROR";
    const TIMED_OUT = "TIMED_OUT";

    const merchantId = req.params.merchantId;
    const merchantTransactionId = req.params.merchantTransactionId;

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = 1;

    const shaPayload =
      `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
    const sha256 = crypto.createHash("sha256").update(shaPayload).digest("hex");

    const xVerifyHeader = sha256 + "###" + saltIndex;

    const options = {
      method: "GET",
      url: `${process.env.PHONEPE_BASE_URL}${process.env.PHONEPE_STATUS_CHECK_URL}/${merchantId}/${merchantTransactionId}`,
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyHeader,
        "X-MERCHANT-ID": merchantId,
      },
    };

    const response = await axios.request(options);

    const paymentStatusResponse = response.data;

    if (paymentStatusResponse) {
      if (
        paymentStatusResponse.code == PAYMENT_SUCCESS &&
        paymentStatusResponse.success
      ) {
        res.setHeaders("Location","https://www.venusethnic.com/#/payment-processing");

        res.status(303).redirect(`https://www.venusethnic.com/#/payment-processing`);
      }

      if (
        paymentStatusResponse.code == PAYMENT_DECLINED ||
        paymentStatusResponse.code == PAYMENT_ERROR ||
        paymentStatusResponse.code == TIMED_OUT
      ) {
        res.redirect(`${process.env.WEBAPP_URL}#/order-fail`);
      }
    }

    //res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.phonePeStatusCheck = async (req, res) => {
  try {
    const merchantId = req.params.merchantId;
    const merchantTransactionId = req.params.merchantTransactionId;

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = 1;

    const shaPayload =
      `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
    const sha256 = crypto.createHash("sha256").update(shaPayload).digest("hex");

    const xVerifyHeader = sha256 + "###" + saltIndex;

    const options = {
      method: "get",
      url: `${process.env.PHONEPE_BASE_URL}${process.env.PHONEPE_STATUS_CHECK_URL}/${merchantId}/${merchantTransactionId}`,
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyHeader,
        "X-MERCHANT-ID": merchantId,
      },
    };

    const response = await axios.request(options);

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.phonePeRefund = async (req, res, next) => {
  try {
    const data = req.body;

    const phonePeRefundPayload = {
      merchantId: process.env.PHONEPE_MERCHANTID,
      merchantTransactionId: data.merchantTransactionId,
      originalTransactionId: data.originalTransactionId,
      //merchantUserId: data.userId,
      amount: data.amount * 100,
      callbackUrl: "https://venusethnic.com/",
    };

    const base64Payload = Buffer.from(
      JSON.stringify(phonePeRefundPayload)
    ).toString("base64");

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = 1;

    const shaPayload = base64Payload + "/pg/v1/refund" + saltKey;
    const sha256 = crypto.createHash("sha256").update(shaPayload).digest("hex");

    //SHA256(Base64 encoded payload + “/pg/v1/pay” + salt key) + ### + salt index
    const checksum = sha256 + "###" + saltIndex;

    const options = {
      method: "POST",
      url: `${process.env.PHONEPE_BASE_URL}${process.env.PHONEPE_REFUND_URL}`,
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      data: { request: base64Payload },
    };

    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    next(error);
  }
};
