const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

// Transaction-route

router.get("/transactions", async (req, res) => {
  const accountId = parseInt(req.query.accountId);
  try {
    await poolConnect;
    const result = await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query(
        "SELECT * FROM Transactions WHERE account_id = @accountId ORDER BY created_at ASC"
      );
    const transactions = result.recordset;
    const accountResult = await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query("SELECT * FROM Accounts WHERE id = @accountId");
    const account = accountResult.recordset[0];
    let runningBalance =
      account.balance - transactions.reduce((sum, t) => sum + t.amount, 0); // Vi starter med den nuværende saldo og trækker transaktionerne fra. På den måde får vi den rigtige saldo efter hver transaktion. Dette gøres ved at bruge reduce til at summere alle transaktionerne og trække dem fra den nuværende saldo.
    const transactionsWithBalance = transactions.map((trans) => {
      runningBalance += trans.amount;
      return { ...trans, balance_after: runningBalance };
    });
    res.render("transactions", {
      transactions: transactionsWithBalance,
      account,
    });
  } catch (err) {
    console.error("Fejl ved hentning af transaktioner:", err);
    res.status(500).send("Noget gik galt ved hentning af transaktioner.");
  }
});

module.exports = router;
