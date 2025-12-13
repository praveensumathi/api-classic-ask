var express = require("express");
// var path = require('path');
var cookieParser = require("cookie-parser");
var logger = require("morgan");
require("dotenv").config();
const mongoose = require("mongoose");
var cors = require("cors");

var app = express();

//env variables imports goes here
const port = process.env.PORT || 3000;
const connectionString = process.env.CONNECTION_STRING || "";

//Routes imports goes here
var productRouter = require("./routes/product");
var categoryRouter = require("./routes/category");
var myBagRouter = require("./routes/myBag");
var orderRouter = require("./routes/orders");
var customerRouter = require("./routes/customer");
var paymentRouter = require("./routes/payment");
var offlineOrderRouter = require("./routes/offlineOrders");

// Middlewares goes here
app.use((req, res, next) => {
  const allowedOriginsWithCredentials = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://admin.venusethnic.com",
    "https://venusethnic.com",
    "http://admin.venusethnic.com",
    "http://venusethnic.com",
    "https://www.venusethnic.com",
  ];

  const isAllowedWithCredentials = allowedOriginsWithCredentials.some(
    (origin) => req.headers.origin === origin
  );

  if (isAllowedWithCredentials) {
    cors({
      origin: req.headers.origin,
      credentials: true,
    })(req, res, next);
  } else {
    cors()(req, res, next);
  }
});

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// app.use(express.static(path.join(__dirname, 'public')));

//Db Connnection
mongoose
  .connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

//Routes
app.use("/product", productRouter);
app.use("/category", categoryRouter);
app.use("/myBag", myBagRouter);
app.use("/orders", orderRouter);
app.use("/customer", customerRouter);
app.use("/payment", paymentRouter);
app.use("/offlineOrder", offlineOrderRouter);
//these middleware should at last but before error handlers
app.use("*", (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on the server`);
  err.status = "fail";
  err.statusCode = 404;

  next(err);
});

//Error handling middleware
app.use((error, req, res, next) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";
  console.log(error);
  res.status(error.statusCode).json({
    statusCode: error.statusCode,
    status: error.status,
    message: error.message,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
