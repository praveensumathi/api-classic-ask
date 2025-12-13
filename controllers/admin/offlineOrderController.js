const offlineOrderModel = require("../../database/models/offlineOrder");
const ProductModel = require("../../database/models/product");
const { downloadXLSX } = require("../../utils/utils");
const { endOfDay } = require("date-fns");
const mongoose = require("mongoose");

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.createOfflineOrder = async (req, res, next) => {
  try {
    const data = req.body;

    if (data.sizeWithQuantityPrice && data.sizeWithQuantityPrice.length == 0) {
      return res.status(400).json({
        error: "Error While create Order",
      });
    }

    for (const item of data.sizeWithQuantityPrice) {
      if (!item.productId) {
        return res.status(400).json({
          error: "Product code is missing in one of the items",
        });
      }

      const productModel = await ProductModel.findById(
        new mongoose.Types.ObjectId(item.productId)
      );

      if (!productModel) {
        return res.status(404).json({
          error: `Product not found with the provided product code: ${item.productCode}`,
        });
      }
      const productId = productModel._id;

      for (const sizeToUpdate of item.sizes) {
        const selectedSize = productModel.sizes.find(
          (size) => size._id.toString() === sizeToUpdate.sizeId
        );
        if (selectedSize) {
          selectedSize.inStock -= sizeToUpdate.billQuantity;
        }
        const sizeId = selectedSize._id;
        sizeToUpdate.productId = productId;
        sizeToUpdate.sizeId = sizeId;
      }
      await productModel.save();
    }
    const orderNumber = await generateOrderNumber();
    data.orderNumber = orderNumber;

    const createdOfflineOrders = await offlineOrderModel.create(data);

    res.json({
      data: createdOfflineOrders,
      success: true,
      statusCode: 200,
    });
  } catch (error) {
    next(error);
  }
};

const generateOrderNumber = async () => {
  try {
    const latestOrder = await offlineOrderModel
      .findOne({}, { orderNumber: 1 })
      .sort({ _id: -1 })
      .lean();

    let currentNumber;

    if (!latestOrder) {
      currentNumber = 0;
    } else {
      currentNumber = parseInt(latestOrder.orderNumber.slice(6));
    }

    const newNumber = currentNumber + 1;
    const prefix = process.env.OFFLINEORDER_NUMBER_PREFIX;
    const newOrderNumber = prefix + newNumber.toString();

    return newOrderNumber;
  } catch (error) {
    throw error;
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getOfflineOrdersForGstByDateWise = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    if (isNaN(fromDateObj) || isNaN(toDateObj)) {
      return res.status(400).json({
        error:
          "Invalid date format. Please provide valid dates in YYYY-MM-DD format.",
      });
    }

    if (fromDateObj > toDateObj) {
      return res.status(400).json({
        error:
          "Invalid date range. The fromDate should be earlier than the toDate.",
      });
    }

    const formattedToDate = endOfDay(toDateObj);

    const orders = await offlineOrderModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: fromDateObj,
            $lte: formattedToDate,
          },
        },
      },
      {
        $unwind: "$sizeWithQuantityPrice",
      },
      {
        $lookup: {
          from: "products",
          localField: "sizeWithQuantityPrice.productCode",
          foreignField: "productCode",
          as: "product",
        },
      },
      {
        $match: {
          "product.isWithGST": true,
        },
      },
      {
        $group: {
          _id: "$_id",
          sizeWithQuantityPrice: { $push: "$sizeWithQuantityPrice" },
          orderNumber: { $first: "$orderNumber" },
          totalPrice: { $first: "$totalPrice" },
          customerName: { $first: "$customerName" },
          phoneNumber: { $first: "$phoneNumber" },
          discount: { $first: "$discount" },
          modeOfTransaction: { $first: "$modeOfTransaction" },
          createdAt: { $first: "$createdAt" },
        },
      },
      {
        $sort: { createdAt: -1 },
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
exports.getOfflineOrdersReportByDateWise = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.params;
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      return res.status(400).json({
        error:
          "Invalid date format. Please provide valid dates in YYYY-MM-DD format.",
      });
    }

    if (fromDateObj > toDateObj) {
      return res.status(400).json({
        error:
          "Invalid date range. The fromDate should be earlier than the toDate.",
      });
    }
    const formattedToDate = endOfDay(toDateObj);

    const orders = await offlineOrderModel
      .find({
        createdAt: {
          $gte: fromDateObj,
          $lte: formattedToDate,
        },
      })
      .sort({ createdAt: -1 });

    const flattenedData = orders.flatMap((order) => {
      return order.sizeWithQuantityPrice.flatMap((product) => {
        return product.sizes.map((size) => ({
          Order_Number: order.orderNumber,
          Customer_Name: order.customerName,
          Phone_Number: order.phoneNumber,
          Product_Code: product.productCode,
          Size: size.size,
          Offline_SellingPrice: size.offlineSellingPrice,
          Bill_Quantity: size.billQuantity,
          Date: order.createdAt,
          ModeOfTransaction: order.modeOfTransaction,
          Discount: order.discount,
          Total: size.offlineSellingPrice * size.billQuantity - order.discount,
        }));
      });
    });
    flattenedData.sort((a, b) => a.Order_Number.localeCompare(b.Order_Number));

    const pageName = `OfflineOrder(${getMonthAndYearofDate(
      fromDateObj
    )}-${getMonthAndYearofDate(toDateObj)})`;
    const sheetName = "OfflineOrder";
    downloadXLSX(flattenedData, pageName, sheetName, res);
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
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getOfflineOrdersByOrderNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await offlineOrderModel
      .findOne({ orderNumber: new RegExp("^" + orderNumber + "$", "i") })
      .populate({
        path: "sizeWithQuantityPrice.sizes.sizeId",
        select: "_id inStock",
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const offlineOrderDetails = {
      _id: order._id,
      sizeWithQuantityPrice: await Promise.all(
        order.sizeWithQuantityPrice.map(async (item) => {
          var sizes = await Promise.all(
            item.sizes.map(async (size) => {
              const product = await ProductModel.findById(item.productId);

              var inStock = 0;

              if (product) {
                const productSize = product.sizes.find(
                  (productSize) =>
                    productSize._id.toString() === size.sizeId.toString()
                );
                inStock = productSize ? productSize.inStock : 0;
              }

              return {
                sizeId: size.sizeId.toString(),
                size: size.size,
                inStock: inStock,
                offlineSellingPrice: size.offlineSellingPrice,
                billQuantity: size.billQuantity,
                totalPrice: size.totalPrice,
              };
            })
          );

          var response = {
            productId: item.productId,
            title: item.title,
            productCode: item.productCode,
            orderedProductWithSizeObjectId: item._id,
            sizes,
          };
          return response;
        })
      ),

      orderNumber: order.orderNumber,
      totalPrice: order.totalPrice,
      customerName: order.customerName,
      phoneNumber: order.phoneNumber,
      discount: order.discount,
      modeOfTransaction: order.modeOfTransaction,
      createdAt: order.createdAt,
    };

    offlineOrderDetails.sizeWithQuantityPrice =
      offlineOrderDetails.sizeWithQuantityPrice.filter((item) => item != null);

    res.status(200).json(offlineOrderDetails);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.updateOfflineOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const _orderId = new mongoose.Types.ObjectId(orderId);

    const updatedData = req.body;

    const existingOfflineOrder = await offlineOrderModel.findById(_orderId);

    if (!existingOfflineOrder) {
      return res.status(404).json({
        error: `Offline order not found with order number: ${orderId}`,
      });
    }

    for (const existingItem of existingOfflineOrder.sizeWithQuantityPrice) {
      const updatedItem = updatedData.sizeWithQuantityPrice.find(
        (item) =>
          item.orderedProductWithSizeObjectId == existingItem._id.toString()
      );

      if (updatedItem) {
        for (const existingSize of existingItem.sizes) {
          const updatedSize = updatedItem.sizes.find(
            (size) => size.sizeId === existingSize.sizeId.toString()
          );

          if (updatedSize) {
            let billQuantityChange =
              updatedSize.billQuantity - existingSize.billQuantity;

            existingSize.billQuantity = updatedSize.billQuantity;

            const product = await ProductModel.findById(
              new mongoose.Types.ObjectId(updatedItem.productId)
            );

            if (product) {
              const sizeToUpdate = product.sizes.find(
                (size) => size._id.toString() == existingSize.sizeId.toString()
              );

              if (sizeToUpdate) {
                sizeToUpdate.inStock -= billQuantityChange;
              }

              await product.save();
            }
          }
        }
      } else {
        const productToUpdate = await ProductModel.findById(
          existingItem.productId
        );

        if (productToUpdate) {
          for (const existingSize of existingItem.sizes) {
            const sizeToUpdateInstock = productToUpdate.sizes.find(
              (size) => existingSize.sizeId.toString() == size._id
            );

            if (sizeToUpdateInstock) {
              sizeToUpdateInstock.inStock += existingSize.billQuantity;
            }
          }

          await productToUpdate.save();
        }
      }
    }

    existingOfflineOrder.set(updatedData);
    const updatedOfflineOrder = await existingOfflineOrder.save();

    res.json({
      data: updatedOfflineOrder,
      success: true,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

/**
 * @param {Request} req - The Express request object
 * @param {Response} res - The Express response object
 */
exports.getAllOfflineOrders = async (req, res, next) => {
  try {
    const { date, orderNumber } = req.query;

    let matchStage = {};
    if (orderNumber) {
      matchStage.orderNumber = {
        $regex: new RegExp(orderNumber.toLowerCase().trim(), "i"),
      };
    } else if (date) {
      const parsedDate = new Date(date);
      matchStage.createdAt = {
        $gte: parsedDate,
        $lt: new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const offlineOrders = await offlineOrderModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M",
              date: "$createdAt",
            },
          },
          orderNumber: 1,
        },
      },
    ]);

    var response = {
      offlineOrders: offlineOrders,
      total: offlineOrders.length,
    };
    res.json(response);
  } catch (error) {
    error = new Error("Error while getting orders");
    error.statusCode = 513;
    next(error);
  }
};
