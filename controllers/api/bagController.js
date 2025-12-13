/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

const ProductModel = require("../../database/models/product");
const UserModel = require("../../database/models/user");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getMyBag = async (req, res, next) => {
  const products = req.body;
  const result = [];
  let itemsPrice = 0; // Variable to store the total count for all products

  try {
    if (products && products.length > 0) {
      for (const product of products) {
        const { productId, sizes } = product;

        const foundProduct = await ProductModel.findOne(
          { _id: productId },
          { posterURL: 1, title: 1, price: 1, productCode: 1, sizes: 1 }
        );

        if (foundProduct) {
          const productDetail = {
            _id: foundProduct._id,
            posterURL: foundProduct.posterURL,
            title: foundProduct.title,
            productCode: foundProduct.productCode,
            sizes: [],
          };

          sizes.sort((a, b) => b.size.localeCompare(a.size));

          let productTotalCount = 0; // Variable to store the total count for each product

          for (const size of sizes) {
            if (size.qty > 0) {
              const foundSize = foundProduct.sizes.find(
                (sizeObj) => sizeObj.size === size.size
              );
              if (foundSize) {
                const sizePrizeTotal =
                  Number(foundSize.price) * Number(size.qty);

                productDetail.sizes.push({
                  size: foundSize.size,
                  price: foundSize.price,
                  qty: size.qty,
                });

                productTotalCount += sizePrizeTotal; // Increment productTotalCount with the totalCount of each size
              }
            }
          }

          itemsPrice += productTotalCount; // Increment totalProductCount with the productTotalCount

          if (productDetail.sizes.length !== 0) {
            result.push({
              ...productDetail,
            });
          }
        }
      }

      res.json({
        result: result,
        itemsPrice: itemsPrice,
        itemsCount: result.length,
      });
    } else {
      res.json({
        result: [],
        itemsPrice: 0,
        itemsCount: 0,
      });
    }
  } catch (error) {
    error = new Error("No Product available");
    error.statusCode = 455;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.checkOut = async (req, res, next) => {
  const { products, userId } = req.body;

  let itemsPrice = 0;
  let netWeightTotal = 0;

  try {
    if (products && products.length > 0) {
      for (const product of products) {
        const { productId, sizes } = product;

        const foundProduct = await ProductModel.findOne({ _id: productId });

        const user = await UserModel.findById(userId);

        isReseller = user.isReseller;

        if (foundProduct) {
          let productTotalCount = 0;
          let productNetWeight = 0;

          for (const size of sizes) {
            if (size.qty > 0) {
              const foundSize = foundProduct.sizes.find(
                (sizeObj) => sizeObj.size === size.size
              );
              if (foundSize) {
                const price = isReseller
                  ? foundSize.resellingPrice
                  : foundSize.price;

                const totalCount = Number(price) * Number(size.qty);
                const netWeight =
                  (Number(foundSize.netWeight) * Number(size.qty)) / 1000;
                productTotalCount += totalCount;
                productNetWeight += netWeight;
              }
            }
          }

          itemsPrice += productTotalCount;
          netWeightTotal += productNetWeight;
        }
      }

      const orderTotal = itemsPrice;
      res.json({
        itemsPrice: itemsPrice,
        netWeightTotal: netWeightTotal,
        orderTotal: orderTotal,
      });
    } else {
      throw new Error("No products found");
    }
  } catch (error) {
    error = new Error("No Product");
    error.statusCode = 456;
    next(error);
  }
};
