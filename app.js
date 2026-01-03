const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const cors = require("cors");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".prod.env"
    : ".env";

require("dotenv").config({path : envFile});

const app = express();

// ===================
// ENV
// ===================
const port = process.env.PORT || 3001;
const connectionString = process.env.CONNECTION_STRING || "";

const allowedOrigins = new Set(
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : []
);

// ===================
// GLOBAL MIDDLEWARES
// ===================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Enable logger only in non-prod
if (process.env.NODE_ENV !== "production") {
  const logger = require("morgan");
  app.use(logger("dev"));
}

// Single CORS instance (FAST)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);

// ===================
// ROUTES (Lazy-friendly)
// ===================
app.use("/product", require("./routes/product"));
app.use("/category", require("./routes/category"));
app.use("/myBag", require("./routes/myBag"));
app.use("/orders", require("./routes/orders"));
app.use("/customer", require("./routes/customer"));
app.use("/payment", require("./routes/payment"));
app.use("/offlineOrder", require("./routes/offlineOrders"));

// ===================
// 404 HANDLER
// ===================
app.all("*", (req, res, next) => {
  next({
    statusCode: 404,
    status: "fail",
    message: `Can't find ${req.originalUrl}`,
  });
});

// ===================
// ERROR HANDLER
// ===================
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    statusCode,
    status: err.status || "error",
    message: err.message || "Internal server error",
  });
});

// ===================
// START SERVER FIRST
// ===================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// ===================
// CONNECT DB IN BACKGROUND
// ===================
mongoose
  .connect(connectionString)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));
