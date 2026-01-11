const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema({
  address: {
    type: String, // Full address (textarea)
    required: true,
    trim: true,
  },
  pincode: {
    type: String, // Keep as string (leading zeros safe)
    required: true,
    match: /^[0-9]{6}$/, // Indian pincode validation
  },
  district: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
});

module.exports = AddressSchema;
