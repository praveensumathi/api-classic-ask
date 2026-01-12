/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

const mongoose = require("mongoose");
const ApplicationError = require("../../config/ApplicationError");
const ProductOrderModel = require("../../database/models/orders");
const ProductModel = require("../../database/models/product");
const { isEmptyObject } = require("../../utils/utils");
const UserModel = require("../../database/models/user");
const {
  Roles,
  SECRET_KEY,
  ACCESS_TOKEN_NAME,
} = require("../../constants/Constants");
const jwt = require("jsonwebtoken");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.createNewOrder = async (req, res, next) => {
  try {
    const { items, shippingDetail, paymentInfo, deliveryFee } = req.body;

    const token = req.cookies[ACCESS_TOKEN_NAME];

    const decoded = jwt.verify(token, SECRET_KEY);
    const { userId } = decoded;

    if (!userId) {
      throw new Error("No userId found in request body.");
    }

    var user = await UserModel.findById(userId);
    var isSuperCustomer = user.role == Roles.SUPER_CUSTOMER;

    if (
      (isEmptyObject(paymentInfo) || paymentInfo.status != "PAYMENT_SUCCESS") &&
      !isSuperCustomer
    ) {
      throw new ApplicationError("Payment required", 402);
    }

    const parsedItems = JSON.parse(items);

    if (!parsedItems || parsedItems.length === 0) {
      throw new Error("No product details found in request body.");
    }

    const orderedItems = [];
    let totalPrice = 0;

    if (parsedItems && parsedItems.length > 0) {
      for (const item of parsedItems) {
        const productId = item.productId;
        const product = await ProductModel.findById(productId);
        if (!product) {
          throw new Error("Product not found for productId");
        }

        const orderedSizes = [];
        let itemPrice = 0;

        if (item.sizes && item.sizes.length > 0) {
          for (const size of item.sizes) {
            const productSize = product.sizes.find(
              (prodSize) => prodSize.size === size.size
            );
            if (!productSize) {
              throw new Error(
                `Size not found for productId: ${item.productId}, size: ${size.size}`
              );
            }

            const price = productSize.price * size.qty;

            orderedSizes.push({
              size: size.size,
              quantity: size.qty,
              price: productSize.price,
            });
            itemPrice += price;
          }
        }

        orderedItems.push({
          productId: item.productId,
          title: product.title,
          productCode: product.productCode,
          posterURL: product.posterURL,
          sizes: orderedSizes,
        });
        totalPrice += itemPrice;
      }
    }

    const orderNumber = await generateOrderNumber();

    if (isSuperCustomer) {
      var superCustomerPaymentInfo = {
        merchantId: "supercustomer_merchantId",
        merchantTransactionId: "supercustomer_ordered",
        status: "PAYMENT_SUCCESS",
        originalTransactionId: "supercustomer_ordered",
      };
    }

    var productOrderDoc = await ProductOrderModel.create({
      ...req.body,
      userId: userId,
      productdetail: orderedItems,
      shippingDetail: {
        address: shippingDetail.address,
        phoneNumber: shippingDetail.phoneNumber,
        pincode: shippingDetail.pincode,
        district: shippingDetail.district,
        state: shippingDetail.state,
        name: shippingDetail.customerName,
      },
      totalPrice: totalPrice,
      orderNumber: orderNumber,
      status: 1,
      image: "",
      courierType: "",
      paymentInfo: isSuperCustomer ? superCustomerPaymentInfo : paymentInfo,
      deliveryFee: deliveryFee,
    });

    // Reduce the Instock quantity in the ProductModel for each ordered size
    if (parsedItems && parsedItems.length > 0) {
      for (const item of parsedItems) {
        for (const size of item.sizes) {
          await ProductModel.updateOne(
            { _id: item.productId, "sizes.size": size.size },
            { $inc: { "sizes.$.inStock": -size.qty } }
          );
        }
      }
    }

    res.json({
      data: productOrderDoc._id,
      success: true,
      message: "Order created",
    });
  } catch (error) {
    console.log(error);
    error = new Error("Error");
    error.statusCode = 454;

    next(error);
  }
};

const generateOrderNumber = async () => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = today.getMonth() + 1;
    const isNewFinancialYear = month > 3;

    const financialYear = isNewFinancialYear
      ? `${currentYear}-${(currentYear + 1).toString().slice(2)}`
      : `${currentYear - 1}-${currentYear.toString().slice(2)}`;

    const orderNumberPrefix = `${process.env.ONLINE_ORDER_PREFIX}-${financialYear}-`;

    const regexPattern = new RegExp(`^${orderNumberPrefix}\\d+$`);

    const latestOrder = await ProductOrderModel.findOne(
      {
        orderNumber: regexPattern,
      },
      {
        orderNumber: 1,
      }
    )
      .sort({ _id: -1 })
      .limit(1)
      .lean();

    if (!latestOrder) {
      return `${orderNumberPrefix}1`;
    }

    const currentNumber = parseInt(
      latestOrder.orderNumber.slice(orderNumberPrefix.length),
      10
    );
    const newNumber = currentNumber + 1;
    const newOrderNumber = `${orderNumberPrefix}${newNumber.toString()}`;

    return newOrderNumber;
  } catch (error) {
    throw error;
  }
};

exports.generateOrderNumberAPI = async (req, res, next) => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = today.getMonth() + 1;
    const isNewFinancialYear = month > 3;

    const financialYear = isNewFinancialYear
      ? `${currentYear}-${(currentYear + 1).toString().slice(2)}`
      : `${currentYear - 1}-${currentYear.toString().slice(2)}`;

    const orderNumberPrefix = `${process.env.ONLINE_ORDER_PREFIX}-${financialYear}-`;

    const regexPattern = new RegExp(`^${orderNumberPrefix}\\d+$`);

    const latestOrder = await ProductOrderModel.findOne(
      {
        orderNumber: regexPattern,
      },
      {
        orderNumber: 1,
      }
    )
      .sort({ _id: -1 })
      .limit(1)
      .lean();

    if (!latestOrder) {
      return res.json(`${orderNumberPrefix}1`);
    }

    const currentNumber = parseInt(
      latestOrder.orderNumber.slice(orderNumberPrefix.length),
      10
    );
    const newNumber = currentNumber + 1;
    const newOrderNumber = `${orderNumberPrefix}${newNumber.toString()}`;

    res.json(newOrderNumber);
  } catch (error) {
    //throw error;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getOrdersByUserId = async (req, res, next) => {
  const _userId = new mongoose.Types.ObjectId(req.query.id);

  try {
    let data = await ProductOrderModel.aggregate([
      {
        $match: { userId: _userId },
      },
      { $sort: { orderedDateAndTime: -1 } },
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          productdetail: {
            $map: {
              input: "$productdetail",
              as: "product",
              in: {
                productId: "$$product.productId",
                title: "$$product.title",
                productcode: "$$product.productCode",
                posterURL: "$$product.posterURL",
                sizes: {
                  $map: {
                    input: "$$product.sizes",
                    as: "size",
                    in: {
                      size: "$$size.size",
                      qty: "$$size.quantity",
                      price: "$$size.price",
                    },
                  },
                },
              },
            },
          },
          totalPrice: 1,
          status: 1,
          image: 1,
          orderedDateAndTime: 1,
          showposter: { $arrayElemAt: ["$productdetail.posterURL", 0] },
          deliveryFee: 1,
          //truncate time but KEEP DATE TYPE
          orderDateOnly: {
            $dateTrunc: {
              date: "$orderedDateAndTime",
              unit: "day",
            },
          },
        },
      },
      {
        $group: {
          _id: "$orderDateOnly", // REAL DATE
          orders: { $push: "$$ROOT" },
        },
      },
      //correct chronological sorting
      {
        $sort: { _id: -1 }, //_id is group accumalator key
      },
      //recent 10 dates
      { $limit: 10 },
      {
        $project: {
          orders: 1,
          orderedDate: {
            $dateToString: {
              format: "%d-%m-%Y",
              date: "$_id", //_id is group accumalator key
            },
          },
        },
      },
    ]);
    res.send(data);
  } catch (error) {
    console.log(error);
    error = new Error("An error occurred");
    error.statusCode = 500;
    next(error);
  }
};
