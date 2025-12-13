var express = require("express");
var router = express.Router();

const customersController = require("../controllers/api/customersController");
const adminCustomersController = require("../controllers/admin/customersController");
const { useAuth } = require("../middleware/middleware");

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

//User
router.post("/login", use(customersController.login));
router.post("/signup", use(customersController.signup));
router.get("/logout", use(customersController.logout));
router.get("/isAuthorized", use(customersController.isAuthorized));
router.get(
  "/getUserByUserId/:userId",
  use(customersController.getUserByUserId)
);
router.put("/updateProfile/:userId", use(customersController.updateProfile));

//Admin
router.get(
  "/getAllCustomers",
  useAuth,
  use(adminCustomersController.getAllCustomers)
);
router.delete(
  "/deleteCustomer/:id",
  useAuth,
  use(adminCustomersController.deleteCustomer)
);
router.post("/resetPassword", use(adminCustomersController.resetPassword));
router.post(
  "/generateResetLink",
  useAuth,
  use(adminCustomersController.generateResetLink)
);
router.post("/adminLogin", use(adminCustomersController.adminLogin));
router.get("/isAuthorized", use(adminCustomersController.isAuthorized));
router.put(
  "/makeCustomerAsReseller/:userId",

  use(adminCustomersController.makeCustomerAsReseller)
);
router.post("/createAdmin", use(adminCustomersController.createAdmin));

module.exports = router;
