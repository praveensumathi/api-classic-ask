const mongoose = require("mongoose");

const offlineOrderSchema = new mongoose.Schema(
  {
    sizeWithQuantityPrice: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productCode: String,
        title: String,
        sizes: [
          {
            sizeId: {
              type: mongoose.Schema.Types.ObjectId,
            },
            size: String,
            offlineSellingPrice: Number,
            purchasePrice: Number,
            billQuantity: Number,
            totalPrice: Number,
          },
        ],
      },
    ],

    orderNumber: String,
    totalPrice: Number,
    customerName: String,
    phoneNumber:String,
    discount: Number,
    modeOfTransaction: String,
  },
  { timestamps: true }
);

const offlineOrderModel = mongoose.model("offlineorders", offlineOrderSchema);

module.exports = offlineOrderModel;
