const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: String,
  image: String,
  description: {
    type: String,
    required: false,
  },
});

const CategoryModel = mongoose.model("category", categorySchema);

module.exports = CategoryModel;
