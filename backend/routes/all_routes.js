const express = require("express"); // Henter express frameworket
const router = express.Router(); // Her oprettes en router, som bruges til at håndtere ruterne i applikationen

// Her samler vi alle vores rute-filer
router.use("/", require("./auth_routes.js"));
router.use("/", require("./profile_routes.js"));
router.use("/", require("./account_routes.js"));
router.use("/", require("./portfolio_routes.js"));
router.use("/", require("./transaction_routes.js"));
router.use("/", require("./dashboard_routes.js"));
router.use("/", require("./trade_routes.js"));
router.use("/", require("./navigation_routes.js"));

module.exports = router; // Eksporterer routeren, så den kan bruges i server.js


