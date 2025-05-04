const express = require("express");
const router = express.Router();

// Her samler du ALLE dine rute-filer
router.use("/", require("./auth_routes.js"));
router.use("/", require("./profile_routes.js"));
router.use("/", require("./account_routes.js"));
router.use("/", require("./portfolio_routes.js"));
router.use("/", require("./transaction_routes.js"));
router.use("/", require("./dashboard_routes.js"));
router.use("/", require("./trade_routes.js"));
router.use("/", require("./navigation_routes.js"));

module.exports = router;
