var express = require("express");
const bagController = require("../controllers/api/bagController");
var router = express.Router();

const use = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/getMyBag", use(bagController.getMyBag));
router.post("/checkOut", use(bagController.checkOut));

module.exports = router;