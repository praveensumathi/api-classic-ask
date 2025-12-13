const mongoose = require("mongoose");

const CategoryModel = require("../../database/models/category");

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllProductsByCategory = async (req, res, next) => {
  try {
    const productsByCategory = await CategoryModel.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "allProducts",
        },
      },
      {
        $addFields: {
          filteredProducts: {
            $filter: {
              input: { $slice: ["$allProducts", 10] },
              as: "product",
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$$product.sizes",
                        as: "size",
                        cond: { $gt: ["$$size.inStock", 0] },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          filteredProducts: { $ne: [] },
        },
      },
      {
        $addFields: {
          products: {
            $map: {
              input: "$filteredProducts",
              as: "product",
              in: {
                _id: "$$product._id",
                title: "$$product.title",
                posterURL: "$$product.posterURL",
                price: "$$product.price",
                productCode: "$$product.productCode",
                discount: "$$product.discount",
                MRPprice: { $arrayElemAt: ["$$product.sizes.MRPprice", 0] },
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          products: 1,
        },
      },
    ]);
    res.json(productsByCategory);
  } catch (error) {
    error = new Error("No products Available");
    error.statusCode = 457;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

exports.fetchProductsByCategory = async (req, res, next) => {
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
        $addFields: {
          products: {
            $filter: {
              input: {
                $map: {
                  input: "$Allproducts",
                  as: "product",
                  in: {
                    _id: "$$product._id",
                    title: "$$product.title",
                    posterURL: "$$product.posterURL",
                    price: "$$product.price",
                    productCode: "$$product.productCode",
                    discount: "$$product.discount",
                    MRPprice: { $arrayElemAt: ["$$product.sizes.MRPprice", 0] },
                    sizes: {
                      $filter: {
                        input: {
                          $map: {
                            input: "$$product.sizes",
                            as: "size",
                            in: {
                              $cond: {
                                if: { $gt: ["$$size.inStock", 0] },
                                then: "$$size.size",
                                else: null,
                              },
                            },
                          },
                        },
                        as: "size",
                        cond: { $ne: ["$$size", null] },
                      },
                    },
                  },
                },
              },
              as: "product",
              cond: { $ne: ["$$product.sizes", []] },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          image: 1,
          products: 1,
        },
      },
    ]);

    const paginatedProducts =
      categoryWithProducts.length > 0 ? categoryWithProducts[0].products : [];

    const result = {
      ...categoryWithProducts[0],
      products: paginatedProducts,
    };

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.fetchCategory = async (req, res) => {
  var course = await CategoryModel.find();
  res.json(course);
};
