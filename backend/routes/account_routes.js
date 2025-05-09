const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

// Accounts-route

router.get("/accounts", async (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    const userId = req.session.userId;
    try {
      await poolConnect;
      const result = await pool
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT * FROM Accounts WHERE user_id = @userId");
      const accounts = result.recordset;
      res.render("accounts", { accounts, userId });
    } catch (err) {
      console.error("Fejl ved hentning af konti:", err);
      res.status(500).send("Noget gik galt ved hentning af konti.");
    }
  });


  router.post("/create-account", async (req, res) => {
    const { name, currency, bank } = req.body;
    const userId = req.session.userId;
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

  router.post("/deposit", async (req, res) => {
    const { accountId, amount } = req.body;
    const userId = req.session.userId;
    try {
      await poolConnect;
      await pool
        .request()
        .input("accountId", sql.Int, accountId)
        .input("amount", sql.Decimal(18, 2), amount).query(`
          UPDATE Accounts SET balance = balance + @amount WHERE id = @accountId;
          INSERT INTO Transactions (account_id, transaction_type, amount, currency)
          VALUES (@accountId, 'credit', @amount, (SELECT currency FROM Accounts WHERE id = @accountId));
        `);
      res.redirect("/accounts");
    } catch (err) {
      console.error("Fejl ved indbetaling:", err);
      res.status(500).send("Noget gik galt ved indbetaling.");
    }
  });

  router.post("/withdraw", async (req, res) => {
    const { accountId, amount } = req.body;
    const userId = req.session.userId;
    try {
      await poolConnect;
      await pool
        .request()
        .input("accountId", sql.Int, accountId)
        .input("amount", sql.Decimal(18, 2), amount).query(`
        UPDATE Accounts SET balance = balance - @amount WHERE id = @accountId;
        INSERT INTO Transactions (account_id, transaction_type, amount, currency)
        VALUES (@accountId, 'debit', -@amount, (SELECT currency FROM Accounts WHERE id = @accountId));
        `);
      res.redirect("/accounts");
    } catch (err) {
      console.error("Fejl ved hævning:", err);
      res.status(500).send("Noget gik galt ved hævning.");
    }
  });

  router.post("/close-account", async (req, res) => {
    const { accountId } = req.body;
    const userId = req.session.userId;
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
    const userId = req.session.userId;
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

module.exports = router;