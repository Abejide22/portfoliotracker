const express = require("express"); // Henter express frameworket
const router = express.Router(); // Opretter en router
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true })); // Bruges til at læse data fra formularer

// Routes

// Signup-route

// Denne route renderer signup siden og sender en fejlbesked hvis der er en fejl
router.get("/signup", (req, res) => {
  res.render("signup", { error: undefined });
});


router.post("/signup", async (req, res) => {
  
  // Henter data fra formularen på signup siden og hvis password og confirmPassword ikke matcher så sendes der en fejlbesked tilbage til signup siden
  const { username, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render("signup", { error: "Kodeordene matcher ikke." });
  }
  try {
    await poolConnect; // Opretter forbindelse til databasen

    // Tjekker om brugernavnet eller emailen allerede findes i databasen
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
    // Hvis brugernavnet og emailen ikke findes i databasen, så indsættes den nye bruger i databasen
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