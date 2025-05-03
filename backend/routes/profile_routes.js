const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const { getDataByKey } = require("../api_test");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

// Profile-route

router.get("/profile", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    const userId = req.session.userId;
    res.render("profile", { userId, error: null, success: null });
  });

  
  router.post("/profile/update-password", async (req, res) => {
    const { userId, newPassword, confirmPassword } = req.body;
    // Tjek om de to adgangskoder matcher
    if (newPassword !== confirmPassword) {
      return res.render("profile", {
        userId,
        error: "Adgangskoderne matcher ikke.",
        success: null,
      });
    }
    try {
      await poolConnect;
      // Opdater adgangskoden i databasen
      await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("password", sql.NVarChar, newPassword)
        .query("UPDATE Users SET password = @password WHERE id = @userId");
      res.render("profile", {
        userId,
        success: "Adgangskoden er opdateret!",
        error: null,
      });
    } catch (err) {
      console.error("Fejl ved opdatering af adgangskode:", err);
      res.status(500).send("Noget gik galt.");
    }
  });
  

  router.put("/profile/update-password", async (req, res) => {
    const { userId, newPassword, confirmPassword } = req.body;
    // Tjek om de to adgangskoder matcher
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Adgangskoderne matcher ikke." });
    }
    try {
      await poolConnect;
      // Opdater adgangskoden i databasen
      await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("password", sql.NVarChar, newPassword)
        .query("UPDATE Users SET password = @password WHERE id = @userId");
      res.status(200).json({ success: "Adgangskoden er opdateret!" });
    } catch (err) {
      console.error("Fejl ved opdatering af adgangskode:", err);
      res.status(500).json({ error: "Noget gik galt." });
    }
  });

module.exports = router;