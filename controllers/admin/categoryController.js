/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const mongoose = require("mongoose");
const path = require("path");

const CategoryModel = require("../../database/models/category");
const ProductModel = require("../../database/models/product");
const { deleteFromS3, uploadToS3 } = require("../../config/s3Config");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.createCategory = async (req, res, next) => {
  try {
    const formData = req.body;

    var categoryImageS3Location = req.file;

    if (!categoryImageS3Location) {
      throw new Error("Category image is required");
    }

    const existCategory = await CategoryModel.findOne({
      name: { $regex: new RegExp(formData.name, "i") },
    });

    if (existCategory) {
      throw new Error("Category with this name already exists");
    }

    var newCategoryDoc = await CategoryModel.create({
      image: categoryImageS3Location.location,
      description: formData.description,
      name: formData.name.trim(),
    });

    res.json(newCategoryDoc);
  } catch (error) {
    if (req.file) {
      await deleteImageFromS3(req.file.key);
    }
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    if (!categoryId) {
      const error = new Error("category ID is required");
      error.statusCode = 411;
      throw error;
    }
    const formData = req.body;
    if (!formData) {
      const error = new Error("formData not found");
      error.statusCode = 446;
      throw error;
    }

    var categoryImageS3Location = req.file;

    const existCategory = await CategoryModel.findOne({
      _id: { $ne: categoryId },
      name: { $regex: new RegExp(formData.name, "i") },
    });

    if (existCategory) {
      throw new Error("Category with this name already exists");
    }

    var updatedFields = {
      name: formData.name.trim(),
      description: formData.description,
    };

    if (categoryImageS3Location && categoryImageS3Location.location) {
      updatedFields.image = categoryImageS3Location
        ? categoryImageS3Location.location
        : null;
    }

    const existingcategory = await CategoryModel.findByIdAndUpdate(
      categoryId,
      { $set: updatedFields },
      { new: true }
    );

    if (formData.categoryRemoveImage) {
      const decodedPath = decodeURIComponent(formData.categoryRemoveImage);
      var key = path.basename(decodedPath);
      await deleteImageFromS3(key);
    }

    res.json(existingcategory);
  } catch (error) {
    if (req.file) {
      await deleteImageFromS3(req.file.key);
    }
    next(error);
  }
};

const deleteImageFromS3 = async (key) => {
  try {
    if (key) {
      await deleteFromS3(key);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllCategory = async (req, res, next) => {
  try {
    const categories = await CategoryModel.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          image: 1,
          description: 1,
          productCount: 1,
        },
      },
    ]);

    res.json(categories);
  } catch (error) {
    error = new Error("Error get All Category");
    error.statusCode = 513;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      const error = new Error("category ID is required");
      error.statusCode = 418;
      throw error;
    }

    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      const error = new Error("category is not found");
      error.statusCode = 419;
      throw error;
    }
    const { image } = category;

    const deleteResult = await CategoryModel.deleteOne({ _id: categoryId });

    if (deleteResult.acknowledged == false && deleteResult.deletedCount <= 0) {
      const error = new Error("Error while delete category");
      error.statusCode = 521;
      throw error;
    }
    if (image) {
      const decodedPath = decodeURIComponent(image);
      var key = path.basename(decodedPath);
      await deleteImageFromS3(key);
    }
    res.json(deleteResult);
  } catch (error) {
    console.log("168", error);
    error = new Error("Error deleting category");
    error.statusCode = 532;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.fetchProductsByCategoryId = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const _categoryId = new mongoose.Types.ObjectId(categoryId);

    var categoryDoc = await CategoryModel.findById({ _id: _categoryId });

    if (!categoryDoc) {
      const error = new Error("Category not found");
      error.statusCode = 452;
      throw error;
    }

    const categoryWithProducts = await CategoryModel.aggregate([
      {
        $match: {
          _id: _categoryId,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "Allproducts",
        },
      },
      {
        $unwind: "$Allproducts",
      },
      {
        $project: {
          _id: 0,
          _id: "$Allproducts._id",
          title: "$Allproducts.title",
          description: "$Allproducts.description",
          productCode: "$Allproducts.productCode",
          netWeight: "$Allproducts.netWeight",
          posterURL: "$Allproducts.posterURL",
          categoryName: "$name",
          materialType: "$Allproducts.materialType",
          categoryId: "$_id",
          sizes: {
            $map: {
              input: "$Allproducts.sizes",
              as: "size",
              in: {
                size: "$$size.size",
                inStock: "$$size.inStock",
                price: "$$size.price",
                MRPprice: "$$size.MRPprice",
              },
            },
          },
        },
      },
    ]);

    res.json(categoryWithProducts.length > 0 ? categoryWithProducts : []);
  } catch (error) {
    next(error);
  }
};
