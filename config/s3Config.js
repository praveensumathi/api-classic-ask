const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
} = require("@aws-sdk/client-s3");
require("dotenv").config();
const { randomBytes } = require("crypto");
const multer = require("multer");
const multerS3 = require("multer-s3");

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const s3AccessKey = process.env.ACCESS_KEY;
const s3SecretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3Client = new S3Client({
  region: bucketRegion,
  credentials: {
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretAccessKey,
  },
});

const randomImageName = (byte = 6) => randomBytes(byte).toString("hex");

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const uploadByMulterS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `${Date.now().toString()}-${file.originalname}`);
    },
  }),
  fileFilter: fileFilter,
});

const uploadByMulterS3AsAttachement = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    contentDisposition: "attachment",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `${Date.now().toString()}-${file.originalname}`);
    },
  }),
  fileFilter: fileFilter,
});

const uploadToS3 = async (buffer, fileName, extension) => {
  try {
    if (buffer) {
      fileName = `${randomImageName()}-${fileName}`;

      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: Buffer.from(buffer),
        ContentType: extension,
      });

      await s3Client.send(putCommand);
      return fileName;
    }
  } catch (error) {
    console.log(error);
    // throw error;
  }
};

const deleteFromS3 = async (fileName) => {
  try {
    if (fileName) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });

      await s3Client.send(deleteCommand);

      console.log(`S3 Image Deleted = ${fileName}`);
    }
  } catch (error) {
    console.log(error);
    // throw error;
  }
};

const deleteMultipleFromS3 = async (fileNames = []) => {
  try {
    if (!Array.isArray(fileNames)) return;

    if (!fileNames.length) return;

    const deleteParams = {
      Bucket: bucketName,
      Delete: {
        Objects: fileNames.map((fileName) => ({
          Key: fileName,
        })),
        Quiet: false, // set true if you don't want detailed response
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting multiple files from S3:", error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  deleteMultipleFromS3,
  s3Client,
  uploadByMulterS3,
  uploadByMulterS3AsAttachement,
};
