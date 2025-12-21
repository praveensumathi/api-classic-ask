/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const fs = require("fs");
var Jimp = require("jimp");

const {
  PRODUCT_IMAGES_FIELDNAME,
  PRODUCT_POSTER_IMAGE,
  PRODUCT_CODE,
} = require("../../constants/Constants");
const CategoryModel = require("../../database/models/category");
const ProductModel = require("../../database/models/product");
const path = require("path");
const {
  uploadImageWithCodeByCanvas,
  downloadXLSX,
} = require("../../utils/utils");
const { deleteFromS3, deleteMultipleFromS3 } = require("../../config/s3Config");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

const formatDateForMongoDB = (dateString) => {
  const dateObject = new Date(dateString);
  const year = dateObject.getFullYear();
  const month = (dateObject.getMonth() + 1).toString().padStart(2, "0");
  const day = dateObject.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

exports.createProduct = async (req, res, next) => {
  var uploadedProductImages = [];
  var uploadedProductPosterImage = null;

  try {
    const formData = req.body;

    var productImageFiles = [];
    var productPosterImageFile = null;
    var sizes = [];

    if (formData.sizes && formData.sizes.length > 0) {
      sizes = formData.sizes.map((item) => {
        const obj = JSON.parse(item);

        return {
          size: obj.size,
          purchasePrice: obj.purchasePrice ? parseInt(obj.purchasePrice) : 0,
          resellingPrice: obj.resellingPrice ? parseInt(obj.resellingPrice) : 0,
          offlineSellingPrice: obj.offlineSellingPrice
            ? parseInt(obj.offlineSellingPrice)
            : 0,
          inStock: obj.inStock ? parseInt(obj.inStock) : 0,
          purchaseQty: obj.inStock ? parseInt(obj.purchaseQty) : 0,
          netWeight: obj.netWeight ? parseInt(obj.netWeight) : 0,
          MRPprice: obj.MRPprice ? parseInt(obj.MRPprice) : 0,
          price: obj.price ? parseInt(obj.price) : 0,
        };
      });
    }

    //let lastProduct = await ProductModel.findOne().sort({ _id: -1 }).limit(1);

    let productCode = `${PRODUCT_CODE}0001`;

    // ✅ If formData.productCode is provided, use it directly
    if (formData.productCode) {
      productCode = formData.productCode;
    } else {
      // Otherwise, generate next product code
      const lastCode = await findLastProductCode(PRODUCT_CODE);

      if (lastCode) {
        const lastNumber = parseInt(lastCode.replace(PRODUCT_CODE, ""), 10);

        if (!isNaN(lastNumber)) {
          productCode = `${PRODUCT_CODE}${(lastNumber + 1)
            .toString()
            .padStart(4, "0")}`;
        }
      }
    }

    if (req.files && req.files.length > 0) {
      productImageFiles = req.files.filter((file) =>
        file.fieldname.startsWith(PRODUCT_IMAGES_FIELDNAME)
      );

      productPosterImageFile = req.files.find((file) =>
        file.fieldname.startsWith(PRODUCT_POSTER_IMAGE)
      );

      if (productImageFiles && productImageFiles.length > 0) {
        for (const file of productImageFiles) {
          var url = await uploadImageWithCodeByCanvas(
            file,
            formData.productCode ? "" : productCode //if formData.productCode exists which means
            //  the image has product code. so no need to draw the product code on the image
          );
          if (url) {
            uploadedProductImages.push(url);
          }
        }
      }

      if (productPosterImageFile) {
        var url = await uploadImageWithCodeByCanvas(
          productPosterImageFile,
          formData.productCode ? "" : productCode //if formData.productCode exists which means
          //  the image has product code. so no need to draw the product code on the image
        );
        if (url) {
          uploadedProductPosterImage = url;
        }
      }
    }

    var newProductDoc = await ProductModel.create({
      title: formData.title,
      images: uploadedProductImages,
      posterURL: uploadedProductPosterImage,
      price: parseInt(formData.price),
      sizes,
      description: formData.description,
      productCode: productCode,
      materialType: formData.materialType,
      category: formData.category,
      purchaseDate: formData.purchaseDate
        ? formatDateForMongoDB(formData.purchaseDate)
        : null,
      sellerName: formData.sellerName,
      //isWithGST: JSON.parse(formData.isWithGST) == true ? true : false,
      isWithGST: false,
    });

    res.json(newProductDoc);
  } catch (error) {
    console.log(error);

    var uploadedUrls = uploadedProductImages;
    if (uploadedProductPosterImage) {
      uploadedUrls = uploadedProductImages.push(uploadedProductPosterImage);
    }

    if (uploadedUrls && uploadedUrls.length > 0) {
      for (const url of uploadedUrls) {
        if (url) {
          await deleteImageFromS3(url);
        }
      }
    }

    error = new Error("Error while create product");
    error.statusCode = 519;
    next(error);
  }
};

/**
 * @param {String} prefix - The Express request object
 */
async function findLastProductCode(prefix) {
  try {
    const result = await ProductModel.aggregate([
      {
        $match: {
          productCode: {
            $regex: `^${prefix}`,
            $options: "i",
          },
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
      {
        $limit: 1,
      },
      {
        $project: {
          _id: 0,
          productCode: 1,
        },
      },
    ]);

    if (result.length > 0) {
      return result[0].productCode;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllProducts = async (req, res, next) => {
  const searchName = req.query.searchName;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.pageSize) || 10;

  const skip = (page - 1) * limit;

  try {
    let matchQuery = {};
    if (searchName) {
      let _searchName = searchName.toLowerCase().trim();
      matchQuery = {
        $or: [
          { productCode: { $regex: _searchName, $options: "i" } },
          { title: { $regex: _searchName, $options: "i" } },
        ],
      };
    }

    const result = await ProductModel.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      ...(searchName ? [{ $match: matchQuery }] : []),
      { $sort: { createdDate: -1 } },
      // {
      //   $project: {
      //     title: 1,
      //     description: 1,
      //     productCode: 1,
      //     purchaseDate: 1,
      //     sellerName: 1,
      //     isWithGST: 1,
      //     posterURL: 1,
      //     categoryName: "$category.name",
      //     materialType: 1,
      //     categoryId: "$category._id",
      //     images: 1,
      //     sizes: {
      //       $map: {
      //         input: "$sizes",
      //         as: "size",
      //         in: {
      //           size: "$$size.size",
      //           purchasePrice: "$$size.purchasePrice",
      //           resellingPrice: "$$size.resellingPrice",
      //           offlineSellingPrice: "$$size.offlineSellingPrice",
      //           inStock: "$$size.inStock",
      //           purchaseQty: "$$size.purchaseQty",
      //           netWeight: "$$size.netWeight",
      //           MRPprice: "$$size.MRPprice",
      //           price: { $ifNull: ["$$size.price", "$price"] },
      //         },
      //       },
      //     },
      //   },
      // },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                title: 1,
                description: 1,
                productCode: 1,
                purchaseDate: 1,
                sellerName: 1,
                isWithGST: 1,
                posterURL: 1,
                categoryName: "$category.name",
                materialType: 1,
                categoryId: "$category._id",
                images: 1,
                sizes: {
                  $map: {
                    input: "$sizes",
                    as: "size",
                    in: {
                      size: "$$size.size",
                      purchasePrice: "$$size.purchasePrice",
                      resellingPrice: "$$size.resellingPrice",
                      offlineSellingPrice: "$$size.offlineSellingPrice",
                      inStock: "$$size.inStock",
                      purchaseQty: "$$size.purchaseQty",
                      netWeight: "$$size.netWeight",
                      MRPprice: "$$size.MRPprice",
                      price: { $ifNull: ["$$size.price", "$price"] },
                    },
                  },
                },
              },
            },
          ],
          totalItems: [{ $count: "count" }],
        },
      },
    ]);

    const totalItemsOnDb = result[0].totalItems[0]?.count || 0;
    const totalPages = Math.ceil(totalItemsOnDb / limit);

    var response = {
      products: result[0].data,
      pageInfo: {
        page,
        pageSize: limit,
        totalPages,
        totalItems: totalItemsOnDb,
      },
      total: totalItemsOnDb,
    };

    res.json(response);
  } catch (error) {
    error = new Error("No Products Available");
    error.statusCode = 520;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.updateProduct = async (req, res, next) => {
  var uploadedProductImages = [];
  var uploadedProductPosterImage = null;

  try {
    const productId = req.params.productId;
    if (!productId) {
      const error = new Error("Product ID is required");
      error.statusCode = 411;
      throw error;
    }
    const formData = req.body;

    var removedImages = JSON.parse(formData.removedImages);

    var product = await ProductModel.findById(productId, {
      productCode: 1,
      _id: 1,
      images: 1,
    });

    if (!product._id) {
      const error = new Error("Product is not found");
      error.statusCode = 459;
      throw error;
    }

    var productImageFiles = [];
    var productPosterImageFile = null;

    var sizes = [];
    if (formData.sizes && formData.sizes.length > 0) {
      sizes = formData.sizes.map((item) => {
        const obj = JSON.parse(item);
        return {
          size: obj.size,
          purchasePrice: obj.purchasePrice ? parseInt(obj.purchasePrice) : 0,
          resellingPrice: obj.resellingPrice ? parseInt(obj.resellingPrice) : 0,
          offlineSellingPrice: obj.offlineSellingPrice
            ? parseInt(obj.offlineSellingPrice)
            : 0,
          inStock: obj.inStock ? parseInt(obj.inStock) : 0,
          purchaseQty: obj.inStock ? parseInt(obj.purchaseQty) : 0,
          netWeight: obj.netWeight ? parseInt(obj.netWeight) : 0,
          MRPprice: obj.MRPprice ? parseInt(obj.MRPprice) : 0,
          price: obj.price ? parseInt(obj.price) : 0,
        };
      });
    }

    var updatedFields = {
      _id: formData.id,
      title: formData.title,
      description: formData.description,
      productCode: formData.productCode,
      materialType: formData.materialType,
      category: formData.category,
      price: parseInt(formData.price) ?? 0,
      sizes,
      images: JSON.parse(formData.existingImages),
      purchaseDate: formData.purchaseDate
        ? formatDateForMongoDB(formData.purchaseDate)
        : null,
      sellerName: formData.sellerName,
      //isWithGST: JSON.parse(formData.isWithGST) == true ? true : false,
      isWithGST: false,
    };

    if (req.files && req.files.length > 0) {
      productImageFiles = req.files.filter((file) =>
        file.fieldname.startsWith(PRODUCT_IMAGES_FIELDNAME)
      );

      productPosterImageFile = req.files.find((file) =>
        file.fieldname.startsWith(PRODUCT_POSTER_IMAGE)
      );

      if (productImageFiles && productImageFiles.length > 0) {
        for (const productImage of productImageFiles) {
          var url = await uploadImageWithCodeByCanvas(
            productImage,
            product.productCode.toUpperCase().startsWith(PRODUCT_CODE)
              ? ""
              : updatedFields.productCode
          );
          if (url) {
            uploadedProductImages.push(url);
          }
        }
      }
      if (productPosterImageFile) {
        var url = await uploadImageWithCodeByCanvas(
          productPosterImageFile,
          product.productCode.toUpperCase().startsWith(PRODUCT_CODE)
            ? ""
            : updatedFields.productCode
        );
        if (url) {
          uploadedProductPosterImage = url;
        }
      }
    }

    if (uploadedProductImages && uploadedProductImages.length > 0) {
      updatedFields.images.push(...uploadedProductImages);
    }

    if (uploadedProductPosterImage) {
      updatedFields.posterURL = uploadedProductPosterImage;
    }

    const existingProduct = await ProductModel.findByIdAndUpdate(
      productId,
      { $set: updatedFields },
      { new: true }
    );

    if (removedImages && removedImages.length > 0) {
      const deleteResult = await Promise.allSettled(
        removedImages.filter(Boolean).map((url) => deleteImageFromS3(url))
      ).catch((err) => {
        console.error("Background S3 delete failed:", err);
      });

      console.log(deleteResult);
    }

    res.json(existingProduct);
  } catch (error) {
    var uploadedUrls = uploadedProductImages;

    if (uploadedProductPosterImage) {
      uploadedUrls.push(uploadedProductPosterImage);
    }
    if (uploadedUrls && uploadedUrls.length > 0) {
      for (const url of uploadedUrls) {
        await deleteImageFromS3(url);
      }
    }
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

exports.deleteS3Image = async (req, res, next) => {
  try {
    const url = req.query.url;

    if (url) {
      const decodedPath = decodeURIComponent(url);
      var key = path.basename(decodedPath);
      await deleteFromS3(key);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const deleteImageFromS3 = async (url) => {
  try {
    if (url) {
      const decodedPath = decodeURIComponent(url);
      var key = path.basename(decodedPath);
      await deleteFromS3(key);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await ProductModel.findById(productId);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    const { images, posterURL } = product;

    const deleteImages = [posterURL, ...images];

    const deleteResult = await ProductModel.deleteOne({ _id: productId });

    if (deleteResult.acknowledged == false && deleteResult.deletedCount <= 0) {
      const error = new Error("Error while delete product");
      error.statusCode = 521;
      throw error;
    }

    if (deleteImages && deleteImages.length > 0) {
      for (const url of deleteImages) {
        if (url) {
          await deleteImageFromS3(url);
        }
      }
    }

    console.log(deleteResult);
    res.json(deleteResult);
  } catch (error) {
    console.log(error);
    error = new Error("Error deleting product");
    error.statusCode = 521;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.bulkupload = async (req, res, next) => {
  try {
    const products = req.body;
    // Create an array to store the created products

    const createdProducts = [];

    let allCategoriesFound = true;
    // Iterate over the products array and create a document for each product
    for (const productData of products) {
      const category = await CategoryModel.findOne({
        name: { $regex: new RegExp(productData.category.trim(), "i") },
      });

      if (!category) {
        allCategoriesFound = false;
        break; // No need to continue checking, we already found a missing category
      } else {
        productData.category = category._id;
      }
    }

    if (!allCategoriesFound) {
      const error = new Error("Some Categories mentioned are not found");
      error.statusCode = 404;
      throw error;
    }

    // Pre-fetch the last product code once to avoid querying DB for each item
    let lastCodeInDB = await findLastProductCode(PRODUCT_CODE);
    let lastNumber = lastCodeInDB
      ? parseInt(lastCodeInDB.replace(PRODUCT_CODE, ""), 10)
      : 0;

    for (const productData of products) {
      productData.isWithGST = Boolean(productData.isWithGST);

      let productCode;

      if (!productData.productCode) {
        // Generate productCode if not provided
        lastNumber += 1;

        productCode = `${PRODUCT_CODE}${lastNumber
          .toString()
          .padStart(4, "0")}`;
      }

      // this is for upload product images
      var images = [];
      for (const filepath of productData.images) {
        if (filepath) {
          try {
            const arrayBuffer = await readFileAsArrayBuffer(filepath);
            if (arrayBuffer) {
              const filename = path.basename(filepath);
              var file = {
                buffer: arrayBuffer,
                originalname: filename,
              };

              var uploadedUrl = await uploadImageWithCodeByCanvas(
                file,
                productData.productCode ? "" : productCode
                //if productData.productCode exists which means
                //the image has product code. so no need to draw the product code on the image
              );

              images.push(uploadedUrl);
            } else {
              const error = new Error("Incorrect image path");
              error.statusCode = 400;
              throw error;
            }
          } catch (error) {
            throw new Error(
              `some product image file path is not valid. ${
                productData.productCode ? productData.productCode : ""
              }`
            );
          }
        }
      }
      productData.images = images;

      // this is for posterimage
      const posterPath = productData.posterURL;
      if (posterPath) {
        try {
          const posterBuffer = await readFileAsArrayBuffer(posterPath);
          if (posterBuffer) {
            const posterFilename = path.basename(posterPath);
            var file = {
              buffer: posterBuffer,
              originalname: posterFilename,
            };
            const posterImageUrl = await uploadImageWithCodeByCanvas(
              file,
              productData.productCode ? "" : productCode
              //if productData.productCode exists which means
              //the image has product code. so no need to draw the product code on the image
            );
            productData.posterURL = posterImageUrl;
          } else {
            const error = new Error("some poster image file path is not valid");
            error.statusCode = 400;
            throw error;
          }
        } catch (error) {
          throw new Error(
            `Error while processing poster image. ${
              productData.productCode ? productData.productCode : ""
            }`
          );
        }
      }
      if (!productData.productCode) {
        productData.productCode = productCode;
      }
      const createdProduct = await ProductModel.create(productData);
      createdProducts.push(createdProduct);
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    error.statusCode = error.statusCode || 500; // Set a default status code if not provided
    next(error);
  }
};

function readFileAsArrayBuffer(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, async (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // Check if the image size is greater than 500kb (500 * 1024 bytes)
      if (data.length > 500 * 1024) {
        try {
          // Load the image with jimp
          const image = await Jimp.read(data);

          // Resize the image to 500kb
          await image.scaleToFit(1024, 1024).quality(60);

          // Get the resized image as a buffer
          const resizedData = await image.getBufferAsync(Jimp.MIME_JPEG);

          resolve(resizedData);
        } catch (resizeError) {
          reject(resizeError);
        }
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.productBulkDelete = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    const products = await ProductModel.find(
      { _id: { $in: productIds } },
      { images: 1, posterURL: 1 }
    );

    var deleteImages = [];

    for (const item of products) {
      if (item.images && item.images.length > 0) {
        deleteImages.push(...item.images);
      }

      if (item.posterURL != "" && item.posterURL != null) {
        deleteImages.push(item.posterURL);
      }
    }

    const deletedProducts = await ProductModel.deleteMany({
      _id: { $in: productIds },
    });

    if (deleteImages && deleteImages.length > 0) {
      for (const url of deleteImages) {
        if (url) {
          await deleteImageFromS3(url);
        }
      }
    }

    res.json(deletedProducts);
  } catch (error) {
    error = new Error("Error deleting product");
    error.statusCode = 523;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.resolveFilePath = (req, res) => {
  const filePath = req.query.filePath;
  res.sendFile(path.resolve(filePath));
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

exports.deleteOutOfStock = async (req, res, next) => {
  try {
    const productsToDelete = await ProductModel.find({
      sizes: { $not: { $elemMatch: { inStock: { $gt: 0 } } } },
    });

    if (productsToDelete.length === 0) {
      return res.json({ message: "No out-of-stock products to delete." });
    }

    var deleteImages = [];

    for (const item of productsToDelete) {
      if (item.images && item.images.length > 0) {
        deleteImages.push(...item.images);
      }
    }

    if (productsToDelete.length > 0) {
      const deletedProducts = await ProductModel.deleteMany({
        _id: { $in: productsToDelete.map((product) => product._id) },
      });

      if (deleteImages && deleteImages.length > 0) {
        var fileNamesToDelete = await getS3ImageFileNames(deleteImages);
        if (fileNamesToDelete.length) {
          deleteMultipleFromS3(fileNamesToDelete).catch((err) => {
            console.error("S3 delete failed:", err);
          });
        }
      }
      res.json(deletedProducts);
    }
  } catch (error) {
    error = new Error("Error while delete outOfStock products");
    error.statusCode = 524;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.fetchProductByProductCode = async (req, res, next) => {
  try {
    const productCode = req.params.productCode;
    const product = await ProductModel.findOne({ productCode });

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 406;
      throw error;
    }

    const formattedData = {
      productId: product._id,
      title: product.title,
      productCode: product.productCode,
      sizes: product.sizes.map((size) => ({
        sizeId: size._id,
        size: size.size,
        inStock: size.inStock,
        offlineSellingPrice: size.offlineSellingPrice,
        billQuantity: size.billQuantity || 0,
      })),
    };

    res.json(formattedData);
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseProductReportByDateWise = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;

    const products = await ProductModel.find({
      purchaseDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    });
    const PurchaseProductData = [];
    products.forEach((product) => {
      product.sizes.forEach((size) => {
        PurchaseProductData.push({
          Product_Code: product.productCode,
          Purchase_Date: product.purchaseDate,
          Size: size.size,
          Purchase_Price: size.purchasePrice,
          Purchased_Quantity: size.purchaseQty,
        });
      });
    });
    PurchaseProductData.sort((a, b) =>
      a.Product_Code.localeCompare(b.Product_Code)
    );

    const pageName = `purchaseProducts(${getMonthAndYearofDate(
      fromDate
    )}-${getMonthAndYearofDate(toDate)})`;
    const sheetName = "purchaseProducts";
    downloadXLSX(PurchaseProductData, pageName, sheetName, res);
  } catch (error) {
    next(error);
  }
};

exports.getProductInstockReportByDateWise = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;

    const products = await ProductModel.find({
      purchaseDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    });

    const PurchaseProductInstockData = [];
    products.forEach((product) => {
      product.sizes.forEach((size) => {
        PurchaseProductInstockData.push({
          Product_Code: product.productCode,
          Purchase_Date: product.purchaseDate,
          Size: size.size,
          InStock: size.inStock,
          Purchase_Price: size.purchasePrice,
          Selling_Price: size.price,
        });
      });
    });

    PurchaseProductInstockData.sort((a, b) =>
      a.Product_Code.localeCompare(b.Product_Code)
    );

    const pageName = `ProductsInstock(${getMonthAndYearofDate(
      fromDate
    )}-${getMonthAndYearofDate(toDate)})`;
    const sheetName = "ProductsInstock";
    downloadXLSX(PurchaseProductInstockData, pageName, sheetName, res);
  } catch (error) {
    next(error);
  }
};

const getMonthAndYearofDate = (date) => {
  const givenDate = new Date(date);
  const options = { month: "short", year: "numeric" };

  const formattedDate = givenDate
    .toLocaleString("en-US", options)
    .toUpperCase();
  return formattedDate;
};

/**
 * @param {Sting[]} urls - The Express string array
 */
const getS3ImageFileNames = async (urls = []) => {
  try {
    if (!Array.isArray(urls)) return [];

    const fileNames = urls
      .filter(Boolean) // remove null / undefined
      .map((url) => {
        const decodedPath = decodeURIComponent(url);
        return path.basename(decodedPath);
      });

    return fileNames;
  } catch (error) {
    console.error("Error extracting S3 file names:", error);
    throw error;
  }
};
