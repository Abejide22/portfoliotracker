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
    res.redirect("/dashboard");
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

router.get("/portfolios", async (req, res) => {
  const userId = req.session.userId;

  try {
    await poolConnect;

    // 1. Hent brugerens porteføljer
    const portfoliosResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Portfolios WHERE user_id = @userId");

    const portfolios = portfoliosResult.recordset;

    // 2. For hver portefølje, hent aktier og købshandler
    for (const portfolio of portfolios) {
      const tradesResult = await pool.request()
        .input("portfolioId", sql.Int, portfolio.id)
        .query("SELECT * FROM Trades WHERE portfolio_id = @portfolioId");

      const trades = tradesResult.recordset;

      // 3. Beregn samlet antal aktier, samlet købspris
      let samletAntal = 0;
      let samletKøbspris = 0;

      trades.forEach(trade => {
        samletAntal += trade.quantity_bought;
        samletKøbspris += trade.quantity_bought * trade.buy_price;
      });

      // 4. Beregn GAK (gennemsnitlig anskaffelseskurs)
      let gak = samletAntal > 0 ? samletKøbspris / samletAntal : 0;

      // 5. Hent aktuel pris for hver aktie (valgfrit - vi kan tage gennemsnit for nu)
      let aktuelPris = trades.length > 0 ? trades[trades.length - 1].buy_price : 0;

      // 6. Beregn samlet forventet værdi
      let samletForventetVærdi = samletAntal * aktuelPris;

      // 7. Beregn urealiseret gevinst/tab
      let urealiseretGevinst = samletForventetVærdi - samletKøbspris;

      // 8. Gem resultaterne på portefølje-objektet
      portfolio.samletAntal = samletAntal;
      portfolio.samletKøbspris = samletKøbspris;
      portfolio.gak = gak;
      portfolio.samletForventetVærdi = samletForventetVærdi;
      portfolio.urealiseretGevinst = urealiseretGevinst;
    }

    res.render("portfolios", { portfolios, userId });

  } catch (err) {
    console.error("Fejl ved hentning af porteføljer:", err);
    res.status(500).send("Noget gik galt ved hentning af porteføljer.");
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









// ------------------------------------------------------------------------
// 
// KODE DER HENTER API DATA
//
// ------------------------------------------------------------------------


const yahooFinance = require("yahoo-finance2").default;

// POST: modtager stockName fra fetch og returnerer data i JSON
router.post("/trade", async (req, res) => {
  const stockName = req.body.stockName;

  if (!stockName) {
    return res.status(400).json({ error: "Stock name is required" });
  }

  try {
    // Hent aktiedata fra Yahoo Finance
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const result = await yahooFinance.historical(stockName, {
      period1: thirtyDaysAgo,
      period2: today,
      interval: "1d"
    });

    if (!result || result.length === 0) {
      return res.status(500).json({ error: "No data found for the stock" });
    }

    // Sorter nyeste først
    const sorted = result.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

    const dates = sorted.map(day => day.date.toISOString().split('T')[0]);
    const closes = sorted.map(day => day.close);

    // Returner data som JSON
    res.json({ dates, closes });
  } catch (err) {
    console.error("Fejl ved Yahoo Finance API-kald:", err);
    res.status(500).json({ error: "Fejl ved hentning af data." });
  }
});


// GET: viser trade.ejs og initialiserer siden
router.get("/trade", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const userId = req.session.userId;
  const stockName = req.query.stockName;

  let dates = null;
  let closes = null;
  let portfolios = [];
  let accounts = [];

  try {
    await poolConnect;
    const portfolioResult = await pool.request().query(
      "SELECT name FROM Portfolios"
    );
    portfolios = portfolioResult.recordset;
  } catch (err) {
    console.error("Fejl ved hentning af porteføljer:", err);
  }

  try {
    await poolConnect;
    const accountsResult = await pool.request().query("SELECT name FROM Accounts");
    accounts = accountsResult.recordset;
  } catch(err){
    console.error("Fejl ved hentning af accounts", err);
  }

  if (stockName) {
    try {
      
      const result = await yahooFinance.historical(stockName, {
        period1: new Date("2022-01-01"),
        period2: new Date(),
        interval: "1d"
      });

      // Sorter nyeste først
      const sorted = result.sort((a, b) => new Date(b.date) - new Date(a.date));
      dates = sorted.map(day => day.date.toISOString().split('T')[0]);
      closes = sorted.map(day => day.close);
    } catch (err) {
      console.error("Fejl ved Yahoo Finance API-kald:", err);
    }
  }

  // Returner trade.ejs med alle relevante data
  res.render("trade", { userId, dates, closes, portfolios, accounts });
});





module.exports = router;
