const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("./database/database");
const fs = require("fs");
const { getDataByKey } = require("./api_test");

// Eksempel:
router.get("/dashboard", (req, res) => {
  res.render("dashboard", {
    userId: req.query.userId,
    username: req.query.username,
  });
});

router.get("/", (req, res) => {
  res.redirect("/index");
});

router.get("/index", (req, res) => {
  res.render("index");
});

router.get("/signup", (req, res) => {
  res.render("signup", { error: undefined });
});

router.get("/login", (req, res) => {
  res.render("login", { error: undefined });
});

router.get("/profile", (req, res) => {
  res.render("profile");
});

router.get("/portfolios", (req, res) => {
  res.render("portfolios");
});

router.get("/trade", (req, res) => {
  res.render("trade");
});

router.get("/accounts", async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query("SELECT * FROM Accounts");
    const accounts = result.recordset;
    res.render("accounts", { accounts });
  } catch (err) {
    console.error("Fejl ved hentning af konti:", err);
    res.status(500).send("Noget gik galt ved hentning af konti.");
  }
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

    await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .query(
        `INSERT INTO Users (username, email, password) VALUES (@username, @email, @password)`
      );

    res.redirect("/login");
  } catch (err) {
    console.error("Fejl ved brugeroprettelse:", err);
    res.render("signup", { error: "Noget gik galt." });
  }
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
      return res.render("login", { error: "Forkert brugernavn eller kodeord" });
    }

    res.redirect(`/dashboard?userId=${user.id}&username=${user.username}`);
  } catch (err) {
    console.error("Login-fejl:", err);
    res.status(500).send("Noget gik galt under login.");
  }
});

router.post("/create-account", async (req, res) => {
  const { name, currency, bank } = req.body;
  const userId = 1;

  try {
    await poolConnect;

    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("name", sql.NVarChar, name)
      .input("currency", sql.NVarChar, currency)
      .input("bank", sql.NVarChar, bank)
      .query(
        `INSERT INTO Accounts (user_id, name, currency, bank) VALUES (@user_id, @name, @currency, @bank)`
      );

    res.redirect("/accounts");
  } catch (err) {
    console.error("Fejl ved oprettelse af konto:", err);
    res.status(500).send("Noget gik galt ved oprettelse af konto.");
  }
});

router.post("/close-account", async (req, res) => {
  const { accountId } = req.body;
  try {
    await poolConnect;
    await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query("UPDATE Accounts SET closed_at = GETDATE() WHERE id = @accountId");
    res.redirect("/accounts");
  } catch (err) {
    console.error("Fejl ved lukning af konto:", err);
    res.status(500).send("Noget gik galt ved lukning af konto.");
  }
});

router.post("/reopen-account", async (req, res) => {
  const { accountId } = req.body;
  try {
    await poolConnect;
    await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query("UPDATE Accounts SET closed_at = NULL WHERE id = @accountId");
    res.redirect("/accounts");
  } catch (err) {
    console.error("Fejl ved genåbning af konto:", err);
    res.status(500).send("Noget gik galt ved genåbning af konto.");
  }
});

router.get("/api/data", async (req, res) => {
  const key = req.query.key;
  try {
    const stockData = await getDataByKey(key);
    if (stockData.length === 0) {
      return res.json({ error: "No data found for the given ticker." });
    }
    res.json(stockData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.json({ error: "An error occurred while fetching stock data." });
  }
});

module.exports = router;
