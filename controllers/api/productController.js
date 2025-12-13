/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

const ProductModel = require("../../database/models/product");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
// exports.fetchProductsByCategory = async (req, res) => {
//   try {
//     const categoryId = req.params.categoryId;
//     const products = await ProductModel.find({ category: categoryId });

//     res.json(products);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch products" });
//   }
// };

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.fetchProductByID = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const product = await ProductModel.findById(productId);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 406;
      throw error;
    }

    const filteredSizes = product.sizes.filter((size) => size.inStock > 0);
    product.sizes = filteredSizes;

    res.json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getSizesById = async (req, res, next) => {
  const { productId } = req.params;

  try {
    const product = await ProductModel.findById(productId);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 406;
      throw error;
    }

    const sizes = product.sizes.filter((size) => size.inStock > 0);

    res.json({ sizes });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.checkValidation = async (req, res, next) => {
  const products = req.body;
  const results = [];

  try {
    for (const product of products) {
      const { productId, sizes } = product;
      const foundProduct = await ProductModel.findOne({ _id: productId });

      const errors = [];

      if (foundProduct) {
        var productCode = foundProduct.productCode;

        for (const sizeObj of sizes) {
          const dbSize = foundProduct.sizes.find(
            (size) => size.size === sizeObj.size
          );

          let error = "";

          if (dbSize && dbSize.inStock === 0) {
            error = `We apologize for the inconvenience.The '${sizeObj.size}' size is currently sold out. Please remove it from your choices to continue.`;
          } else if (dbSize && dbSize.inStock === 1 && sizeObj.qty > 1) {
            error = `Quantity you have selected '${sizeObj.size}' size should be equal to the instock count  ${dbSize.inStock}`;
          } else if (dbSize && dbSize.inStock < sizeObj.qty) {
            error = `Quantity you have selected '${sizeObj.size}' size should be equal to or less than the instock count  ${dbSize.inStock}`;
          }

          if (error !== "") {
            errors.push({
              size: sizeObj.size,
              error: error,
            });
          }
        }
      }

      if (errors.length > 0) {
        results.push({
          productId: productId,
          productCode: productCode,
          errors: errors,
        });
      }
    }

    res.json(results);
  } catch (error) {
    error = new Error("Reset link has already been used");
    error.statusCode = 458;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
// This api is for search
exports.searchProduct = async (req, res) => {
  const searchTerm = req.query.searchTerm;

  let data = await ProductModel.aggregate([
    {
      $match: {
        $or: [
          { title: { $regex: searchTerm, $options: "i" } },
          { productCode: { $regex: searchTerm, $options: "i" } },
        ],
      },
    },
    {
      $project: {
        title: 1,
        _id: 1,
        sizes: {
          $map: {
            input: {
              $filter: {
                input: "$sizes",
                as: "size",
                cond: { $gt: ["$$size.inStock", 0] },
              },
            },
            as: "size",
            in: "$$size.size",
          },
        },
        posterURL: 1,
        productCode: 1,
        discount: 1,
        price: { $arrayElemAt: ["$sizes.price", 0] },
      },
    },
    {
      $match: {
        "sizes.0": { $exists: true },
      },
    },
  ]);
  res.send(data);
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getNewArrivalProducts = async (req, res, next) => {
  try {
    const products = await ProductModel.aggregate([
      {
        $project: {
          sizes: {
            $map: {
              input: {
                $filter: {
                  input: "$sizes",
                  as: "size",
                  cond: { $gt: ["$$size.inStock", 0] },
                },
              },
              as: "size",
              in: "$$size.size",
            },
          },
          _id: 1,
          title: 1,
          posterURL: 1,
          price: 1,
          productCode: 1,
          discount: 1,
          purchaseDate: 1,
        },
      },
      {
        $match: {
          "sizes.0": { $exists: true },
        },
      },
      {
        $sort: { purchaseDate: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const productsWithMRP = products.map((product) => {
      return { ...product, MRPprice: product.sizes.MRPprice };
    });

    res.json(productsWithMRP);
  } catch (error) {
    next(error);
  }
};
