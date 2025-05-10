const express = require("express"); // Henter express frameworket
const router = express.Router(); // Opretter en router
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true })); // Bruges til at læse data fra formularer

// Navigation-Route

//
router.get("/", (req, res) => {
  res.redirect("/index");
});


router.get("/index", (req, res) => {
  res.render("index");
});

module.exports = router;




