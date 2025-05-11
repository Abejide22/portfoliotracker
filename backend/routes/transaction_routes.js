const express = require("express"); // Henter express frameworket
const router = express.Router(); // Opretter en router
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true })); // Bruges til at læse data fra formularer

// Routes

// Transaction-route

router.get("/transactions", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login

  // Henter kontoID fra forespørgslen
  const accountId = parseInt(req.query.accountId);


  try {
    await poolConnect; // Opretter forbindelse til databasen

    // Henter alle transaktioner for den givne konto sorteret efter dato
    const result = await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query(
        "SELECT * FROM Transactions WHERE account_id = @accountId ORDER BY created_at ASC"
      );

    // Alle transaktioner for en given konto gemmes
    const transactions = result.recordset;

    // Henter kontooplysninger for den givne konto
    const accountResult = await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query("SELECT * FROM Accounts WHERE id = @accountId");

    // Kontooplysningerne gemmes
    const account = accountResult.recordset[0];

    if (account.user_id !== req.session.userId) {
      return res.status(403).send("Du har ikke adgang til denne konto."); // Bruger forsøger at tilgå andens konto
    }

    let runningBalance = account.balance - transactions.reduce((sum, t) => sum + t.amount, 0); // Vi starter med den nuværende saldo og trækker transaktionerne fra. På den måde får vi den rigtige saldo efter hver transaktion. Dette gøres ved at bruge reduce til at summere alle transaktionerne og trække dem fra den nuværende saldo.
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
