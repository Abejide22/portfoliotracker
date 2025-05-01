const express = require("express");
const router = express.Router();

// Her samler du ALLE dine rute-filer
router.use("/", require("./authRoutes"));
router.use("/", require("./profileRoutes"));
router.use("/", require("./accountRoutes"));
router.use("/", require("./portfolioRoutes"));
router.use("/", require("./transactionRoutes"));
router.use("/", require("./dashboardRoutes"));
router.use("/", require("./tradeRoutes"));
router.use("/", require("./navigationRoutes.js"));

module.exports = router;


