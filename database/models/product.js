const mongoose = require("mongoose");
const CategoryModel = require("./category");

const productSchema = new mongoose.Schema({
  title: String,
  images: [
    {
      type: String,
    },
  ],
  price: Number,
  sizes: [
    {
      size: String,
      purchasePrice: Number,
      inStock: Number,
      purchaseQty: Number,
      netWeight: Number,
      MRPprice: Number,
      resellingPrice: Number,
      price: Number,
      offlineSellingPrice: Number,
    },
  ],
  // color: String,
  createdDate: { type: Date, default: Date.now },
  description: String,
  productCode: String,
  // netWeight: Number,
  purchaseDate: String,
  sellerName: String,
  isWithGST: Boolean,
  materialType: String,
  posterURL: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: CategoryModel },
});

const ProductModel = mongoose.model("Product", productSchema);

module.exports = ProductModel;
