const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Navigation-Route

router.get("/", (req, res) => {
    res.redirect("/index");
  });
  

router.get("/index", (req, res) => {
    res.render("index");
  });

module.exports = router;




