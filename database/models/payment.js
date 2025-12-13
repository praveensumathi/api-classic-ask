const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  merchantId: String,
  merchantTransactionId: String,
  userId: String,
  amount: Number,
  redirectUrl: String,
  callbackUrl: String,
  mobileNumber: String,
  paymentInstrumentType: String,
  checksum: String,
});

const PaymentModel = mongoose.model("Product", paymentSchema);

module.exports = PaymentModel;
