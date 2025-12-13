/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
const ProductOrderModel = require("../../database/models/orders");
const ProductModel = require("../../database/models/product");
const UserModel = require("../../database/models/user");
const { endOfDay } = require("date-fns");
const { downloadXLSX } = require("../../utils/utils");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const { status, courierType, curierCharge, cancelReason } = req.body;

    if (!orderId) {
      const error = new Error("orderId is required");
      error.statusCode = 411;
      throw error;
    }

    if (!status) {
      const error = new Error("status is required");
      error.statusCode = 412;
      throw error;
    }

    const updateOrder = {
      status,
      courierType: courierType ? courierType : "",
      curierCharge: curierCharge ? parseInt(curierCharge) : 0,
      image: req.file && req.file.location ? req.file.location : "",
      cancellationReason: cancelReason,
    };

    let updateProductOrder = await ProductOrderModel.findByIdAndUpdate(
      orderId,
      updateOrder,
      { new: true }
    );

    //if cancelled
    if (status == 3) {
      const canceledOrder = await ProductOrderModel.findById(orderId);

      for (const productDetail of canceledOrder.productdetail) {
        const { productId, sizes } = productDetail;

        try {
          const product = await ProductModel.findById(productId);

          sizes.forEach((orderedSize) => {
            const selectedProductSize = product.sizes.find(
              (size) => size.size === orderedSize.size
            );

            if (selectedProductSize) {
              selectedProductSize.inStock += orderedSize.quantity;
              selectedProductSize.purchaseQty += orderedSize.quantity;
            }
          });

          await product.save();
        } catch (error) {
          console.error(`Error updating product with ID ${productId}:`, error);
        }
      }
    }

    res.json(updateProductOrder);
  } catch (error) {
    error = new Error("Error while updating product status");
    error.statusCode = 500;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status } = req.params;
    const { date, orderNumber } = req.query;

    const parsedStatus = parseInt(status);
    let matchStage = { status: parsedStatus };

    if (orderNumber) {
      matchStage.orderNumber = {
        $regex: new RegExp(orderNumber.toLowerCase().trim(), "i"),
      };
    } else if (date) {
      const parsedDate = new Date(date);
      matchStage.orderedDateAndTime = {
        $gte: parsedDate,
        $lt: new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const ProductOrderDetail = await ProductOrderModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $sort: {
          orderedDateAndTime: -1,
        },
      },
      {
        $project: {
          orderDateAndTime: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$orderedDateAndTime",
            },
          },
          orderNumber: 1,
          hasTrackingAttachment: {
            $cond: {
              if: {
                $and: [{ $ne: ["$image", null] }, { $ne: ["$image", ""] }],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);

    var response = {
      productOrderDetail: ProductOrderDetail,
      total: ProductOrderDetail.length,
    };
    res.json(response);
  } catch (error) {
    error = new Error("Error while getting orders");
    error.statusCode = 513;
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getOrderbyOrderId = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    if (orderId) {
      const orderDetail = await ProductOrderModel.findById({ _id: orderId });
      if (!orderDetail) {
        const error = new Error("Order is not found");
        error.statusCode = 411;
        throw error;
      }

      const userId = orderDetail.userId;
      const user = await UserModel.findById(userId);
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      const userName = user.name;
      const orderWithUserName = { ...orderDetail.toObject(), userName };
      res.json(orderWithUserName);
    } else {
      const error = new Error("Order ID is required");
      error.statusCode = 411;
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllOnlineOrdersForGstByDateWise = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;

    var _fromDate = new Date(fromDate);
    var _toDate = new Date(toDate);

    _toDate = endOfDay(_toDate);

    const today = new Date();
    const currentYear = today.getFullYear();
    const month = today.getMonth() + 1;
    const isNewFinancialYear = month > 3;

    const financialYear = isNewFinancialYear
      ? `${currentYear}-${(currentYear + 1).toString().slice(2)}`
      : `${currentYear - 1}-${currentYear.toString().slice(2)}`;

    if (isNaN(_fromDate) || isNaN(_toDate)) {
      return res.status(400).json({
        error:
          "Invalid date format. Please provide valid dates in YYYY-MM-DD format.",
      });
    }

    if (_fromDate > _toDate) {
      return res.status(400).json({
        error:
          "Invalid date range. The fromDate should be earlier than the toDate.",
      });
    }

    const orders = await ProductOrderModel.aggregate([
      {
        $match: {
          orderedDateAndTime: {
            $gte: _fromDate,
            $lte: _toDate,
          },
          status: 5, //completed
        },
      },
      {
        $unwind: "$productdetail",
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $addFields: {
          alternedOrderNumber: {
            $replaceOne: {
              input: "$orderNumber",
              //find: `VE-O-${currentYear}-`,
              find: `VE-O`,
              replacement: "NKS",
            },
          },
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $group: {
          _id: "$_id",
          userId: { $first: "$userId" },
          orderNumber: { $first: "$alternedOrderNumber" },
          shippingDetail: { $first: "$shippingDetail" },
          orderedDateAndTime: { $first: "$orderedDateAndTime" },
          totalPrice: { $first: "$totalPrice" },
          status: { $first: "$status" },
          courierType: { $first: "$courierType" },
          productdetail: { $push: "$productdetail" },
          userInfo: { $first: "$userInfo" },
        },
      },
      {
        $sort: { orderedDateAndTime: -1 },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          orderNumber: 1,
          orderedDateAndTime: 1,
          totalPrice: 1,
          status: 1,
          courierType: 1,
          productdetail: 1,
          userName: "$userInfo.name",
          shippingUserName: "$shippingDetail.name",
        },
      },
    ]);

    return res.status(200).json({ orders });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getOnlineSellingReport = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const formattedToDate = endOfDay(toDateObj);

    const acceptedOrders = await ProductOrderModel.aggregate([
      {
        $match: {
          status: 5, //order completed
          orderedDateAndTime: {
            $gte: fromDateObj,
            $lt: formattedToDate,
          },
        },
      },
      {
        $unwind: "$productdetail",
      },
      {
        $lookup: {
          from: "products",
          let: {
            productId: { $toObjectId: "$productdetail.productId" },
            selectedSize: "$productdetail.sizes.size",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$productId"],
                },
              },
            },
            {
              $project: {
                sizes: {
                  $filter: {
                    input: "$sizes",
                    as: "size",
                    cond: {
                      $in: ["$$size.size", "$$selectedSize"],
                    },
                  },
                },
              },
            },
          ],
          as: "products",
        },
      },
      {
        $unwind: "$products",
      },
      {
        $unwind: "$productdetail.sizes",
      },

      {
        $group: {
          _id: "$_id",
          status: { $first: "$status" },
          orderedDateAndTime: { $first: "$orderedDateAndTime" },
          orderNumber: { $first: "$orderNumber" },
          totalPrice: { $first: "$totalPrice" },
          courierType: { $first: "$courierType" },
          deliveryFee: { $first: "$deliveryFee" },
          purchasePrice: {
            $first: "$products.sizes.purchasePrice",
          },
          quantities: { $push: "$productdetail.sizes.quantity" },
        },
      },
      {
        $project: {
          _id: 1,
          status: 1,
          orderedDateAndTime: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$orderedDateAndTime",
            },
          },
          orderNumber: 1,
          totalPrice: 1,
          courierType: 1,
          deliveryFee: 1,
          purchasePrice: 1,
          quantities: 1,
        },
      },
    ]);

    const formattedAcceptedOrders = acceptedOrders.map((order) => ({
      Order_Date: order.orderedDateAndTime,
      Order_Number: order.orderNumber,
      Total_Price: order.totalPrice,
      Transportation_Partner: order.courierType,
      Transportation_Charges: order.deliveryFee,
      Purchase_Price: order.purchasePrice,
      Quantities: order.quantities,
    }));

    formattedAcceptedOrders.sort((a, b) =>
      a.Order_Date.localeCompare(b.Order_Date)
    );

    formattedAcceptedOrders.forEach((order) => {
      order.Total_Purchase_Price = order.Quantities.reduce(
        (acc, quantity, index) => acc + quantity * order.Purchase_Price[index],
        0
      );

      order.Profit_Price = order.Total_Purchase_Price - order.Total_Price;
    });

    formattedAcceptedOrders.forEach((order) => {
      delete order.Purchase_Price;
      delete order.Quantities;
    });

    const pageName = `AcceptedOrders(${getMonthAndYearofDate(
      fromDateObj
    )}-${getMonthAndYearofDate(toDateObj)})`;
    const sheetName = "AcceptedOrdersReports";
    downloadXLSX(formattedAcceptedOrders, pageName, sheetName, res);
  } catch (error) {
    console.error("Error while getting accepted orders:", error);
    error.statusCode = 513;
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
