/* Denne fil er en del af backend. Den håndterer ruterne
og forespørgslerne til serveren. Når brugeren besøger en side,
så sender der en forespørgsel til serveren, og serveren sender
siden tilbage til brugeren.
*/

/*
Denne fil bruger nu sessions til at beskytte ruter:
I stedet for at brugeren kan manipulere med ?userId=... i URL'en, gemmes userId i req.session.userId,
når brugeren logger ind. Det gør det både sikrere og mere elegant.
*/

const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("./database/database");
const fs = require("fs");
const { getDataByKey } = require("./api_test");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

router.get("/dashboard", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;
  res.render("dashboard", { userId });
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
  res.render("index", { error: undefined });
});

router.get("/profile", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;
  res.render("profile", { userId, error: null, success: null });
});

router.get("/portfolios", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;
  res.render("portfolios", { userId });
});

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
    res.redirect("/accounts");
  } catch (err) {
    console.error("Login-fejl:", err);
    res.status(500).send("Noget gik galt under login.");
  }
});

// Logud-route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Fejl ved logud:", err);
      return res.status(500).send("Noget gik galt ved logud.");
    }
    res.redirect("/login");
  });
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

router.get("/addportfolio", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;

  try {
    await poolConnect;
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Accounts WHERE user_id = @userId");
    const accounts = result.recordset;

    res.render("addportfolios", { userId, accounts });
  } catch (err) {
    console.error("Fejl ved hentning af konti:", err);
    res.status(500).send("Noget gik galt ved hentning af konti.");
  }
});

router.post("/create-portfolio", async (req, res) => {
  const { portfolioName, accountId } = req.body;
  const userId = req.session.userId;

  try {
    await poolConnect;

    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("account_id", sql.Int, accountId)
      .input("name", sql.NVarChar, portfolioName).query(`
        INSERT INTO Portfolios (user_id, account_id, name, created_at)
        VALUES (@user_id, @account_id, @name, GETDATE());
      `);

    res.redirect("/portfolios");
  } catch (err) {
    console.error("Fejl ved oprettelse af portefølje:", err);
    res.status(500).send("Noget gik galt ved oprettelse af portefølje.");
  }
});

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
    // Beregn løbende saldo efter hver transaktion
    let runningBalance = 0;
    const transactionsWithBalance = transactions.map((trans) => {
      runningBalance += trans.amount;
      return { ...trans, balance_after: runningBalance };
    });
    const accountResult = await pool
      .request()
      .input("accountId", sql.Int, accountId)
      .query("SELECT * FROM Accounts WHERE id = @accountId");
    const account = accountResult.recordset[0];
    res.render("transactions", {
      transactions: transactionsWithBalance,
      account,
    });
  } catch (err) {
    console.error("Fejl ved hentning af transaktioner:", err);
    res.status(500).send("Noget gik galt ved hentning af transaktioner.");
  }
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

// POST: modtager stockName fra form
router.post("/trade", (req, res) => {
  const stockName = req.body.stockName;
  res.redirect(`/trade?stockName=${encodeURIComponent(stockName)}`);
});

// GET /trade - viser aktiedata for valgt aktie
router.get("/trade", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  const userId = req.session.userId;
  const stockName = req.query.stockName;
  if (!stockName) {
    return res.render("trade", { userId, last30Days: null });
  }
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${stockName}&apikey=UWEODA1EXLUVVU77`;
  request.get(
    {
      url: url,
      json: true,
      headers: { "User-Agent": "request" },
    },
    (err, apiRes, data) => {
      if (err) {
        console.log("Error:", err);
        return res.status(500).send("Fejl ved API-kald.");
      }
      const timeSeries = data["Time Series (Daily)"];
      if (!timeSeries) {
        return res.status(500).send("Ingen data fundet.");
      }
      const dates = Object.keys(timeSeries).sort(
        (a, b) => new Date(b) - new Date(a)
      );
      const last30Days = dates.slice(0, 30).map((date) => ({
        date,
        data: timeSeries[date],
      }));
      res.render("trade", { userId, last30Days });
    }
  );
});

router.get("/trade", async (req, res) => {
  try {
    await pool.connect(); // Vent på, at forbindelsen til databasen er klar

    // Hent portfolionavne fra databasen
    const result = await pool
      .request()
      .query("SELECT name FROM Portfolios ORDER BY name ASC");

    const portfolios = result.recordset;

    // Log dataen for at kontrollere, at den er korrekt
    console.log("Portfolios:", portfolios); // Log dette i backend for at kontrollere dataen

    // Send portfolios som en del af renderingen
    res.render("trade", { portfolios: portfolios });
  } catch (err) {
    console.error("Fejl ved hentning af portfolier:", err);
    res.status(500).send("Noget gik galt ved hentning af portfolier.");
  }
});

module.exports = router;
