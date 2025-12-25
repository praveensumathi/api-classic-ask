const { createCanvas, loadImage } = require("canvas");
const { uploadToS3 } = require("../config/s3Config");
const path = require("path");
const { log } = require("console");
const XLSX = require("xlsx");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../constants/Constants");
const UserModel = require("../database/models/user");

exports.uploadImageWithCodeByCanvas = async (file, productCode) => {
  try {
    const imageFile = file;

    const image = await loadImage(imageFile.buffer);

    const canvas = createCanvas(image.width, image.height); // Set desired dimensions
    const ctx = canvas.getContext("2d");
    const font = "900 48px Arial";
    const txt = productCode;
    const x = image.width - 200;
    const y = 50;
    const padding = 20;

    // Measure the text dimensions
    ctx.drawImage(image, 0, 0);

    ctx.font = font;
    ctx.textBaseline = "top";

    ctx.fillStyle = "black";
    ctx.fillText(txt, x + padding / 2, y + padding / 2);

    const buffer = canvas.toBuffer("image/jpeg");
    const imageUrl = await uploadInS3(imageFile, buffer);
    return imageUrl;
  } catch (error) {
    console.log(error);
    error = new Error("Error while add code on image");
    error.statusCode = 450;
    throw error;
  }
};

const uploadInS3 = async (imageFile, buffer) => {
  try {
    if (buffer) {
      const fileExt = path.extname(imageFile.originalname);
      var uploadedFileName = await uploadToS3(
        buffer,
        imageFile.originalname,
        fileExt
      );
      var url = `${process.env.BUCKET_URL}${uploadedFileName}`;
      return url;
    }
  } catch (error) {
    console.log(error);
    error = new Error("Error while upload image");
    error.statusCode = 451;
    throw error;
  }
};

exports.downloadXLSX = (
  data,
  fileName,
  sheetName,
  res,
  worksheetOptions = {}
) => {
  try {
    const workSheet = Array.isArray(data)
      ? XLSX.utils.aoa_to_sheet(data)
      : XLSX.utils.json_to_sheet(data);

    Object.assign(workSheet, worksheetOptions);

    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, sheetName);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${fileName}.xlsx`
    );

    const buffer = XLSX.write(workBook, { bookType: "xlsx", type: "buffer" });
    res.end(buffer);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.isEmptyObject = (_object) => {
  if (_object && Object.keys(_object).length > 0) {
    return false;
  }
  return true;
};

exports.validateAccessToken = async (token) => {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const { userId } = decoded;

    // Check if the userId exists in the UserModel database
    const user = await UserModel.findById(userId);
    if (!user) {
      const error = new Error("user not found");
      error.statusCode = 409;
      throw error;
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * @param {String} string1 - The Express request object
 * @param {String} string2 - The Express request object
 */
exports.isEqualStringIgnoreCase = (string1, string2) => {
  if (typeof string1 !== "string" || typeof string2 !== "string") return false;
  return string1.trim().toLowerCase() === string2.trim().toLowerCase();
};
