const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const { getDataByKey } = require("../api_test");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

// Signup-route

router.get("/signup", (req, res) => {
    res.render("signup", { error: undefined });
  });

router.post("/signup", async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.render("signup", { error: "Kodeordene matcher ikke." });
    }
    try {
      await poolConnect;
      const checkResult = await pool
        .request()
        .input("username", sql.NVarChar, username)
        .input("email", sql.NVarChar, email)
        .query(
          `SELECT * FROM Users WHERE username = @username OR email = @email`
        );
      if (checkResult.recordset.length > 0) {
        return res.render("signup", {
          error: "Brugernavn eller email findes allerede",
        });
      }
      const insertResult = await pool
        .request()
        .input("username", sql.NVarChar, username)
        .input("email", sql.NVarChar, email)
        .input("password", sql.NVarChar, password)
        .query(
          `INSERT INTO Users (username, email, password) OUTPUT INSERTED.id VALUES (@username, @email, @password)`
        );
      const newUserId = insertResult.recordset[0].id;
      res.redirect(`/dashboard?userId=${newUserId}`);
    } catch (err) {
      console.error("Fejl ved brugeroprettelse:", err);
      res.render("signup", { error: "Noget gik galt." });
    }
  });

// Login-route

router.get("/login", (req, res) => {
    res.render("index", { error: undefined });
  });

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      await poolConnect;
      const result = await pool
        .request()
        .input("username", sql.NVarChar, username)
        .query(`SELECT * FROM Users WHERE username = @username`);
      const user = result.recordset[0];
      if (!user || user.password !== password) {
        return res.render("index", { error: "Forkert brugernavn eller kodeord" });
      }
      req.session.userId = user.id;
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Login-fejl:", err);
      res.status(500).send("Noget gik galt under login.");
    }
  });

// Logout-route

router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Fejl ved logud:", err);
        return res.status(500).send("Noget gik galt ved logud.");
      }
      res.redirect("/login");
    });
  });


module.exports = router;