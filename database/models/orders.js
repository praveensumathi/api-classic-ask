const mongoose = require("mongoose");
const UserModel = require("./user");

const productorderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: UserModel,
    required: true,
  },
  orderNumber: String,
  productdetail: [
    {
      productId: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      productCode: {
        type: String,
        required: true,
      },
      posterURL: {
        type: String,
        required: true,
      },

      sizes: [
        {
          size: {
            type: String,
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
          },
          price: {
            type: Number,
            required: true,
          },
          netWeight: Number,
        },
      ],
    },
  ],
  shippingDetail: {
    name: {
      type : String
    },
    address: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
  },
  orderedDateAndTime: {
    type: Date,
    default: Date.now,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
  },
  status: {
    type: Number,
    required: true,
  },
  image: String,
  courierType: String,
  paymentInfo: {
    merchantId: {
      type: String,
      required: true,
    },
    merchantTransactionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    originalTransactionId: {
      type: String,
      required: true,
    },
  },
  curierCharge: {
    type: Number,
    default: 0,
  },
  cancellationReason: {
    type: String,
    default: "",
  },
});

const ProductOrderModel = mongoose.model("orders", productorderSchema);

module.exports = ProductOrderModel;
