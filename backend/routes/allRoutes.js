const express = require("express"); // Henter express frameworket
const router = express.Router(); // Her oprettes en router, som bruges til at håndtere ruterne i applikationen

// Her samler vi alle vores rute-filer
router.use("/", require("./authRoutes.js"));
router.use("/", require("./profileRoutes.js"));
router.use("/", require("./account_routes.js"));
router.use("/", require("./portfolioRoutes.js"));
router.use("/", require("./transactionRoutes.js"));
router.use("/", require("./dashboardRoutes.js"));
router.use("/", require("./tradeRoutes.js"));
router.use("/", require("./navigationRoutes.js"));

module.exports = router; // Eksporterer routeren, så den kan bruges i server.js


