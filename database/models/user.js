const mongoose = require("mongoose");
const AddressSchema = require("./address");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  email: String,
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  isReseller: {
    type: Boolean,
  },
  resetToken: { type: String, default: null },
  address: {
    type: AddressSchema,
    required: false,
  },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
