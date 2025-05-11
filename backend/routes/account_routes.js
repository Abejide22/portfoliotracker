const express = require("express"); // Importerer express
const router = express.Router(); // importerer router fra express
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

// Accounts-route

router.get("/accounts", async (req, res) => { // Hentning af konti
    if (!req.session.userId) return res.redirect("/login"); // Tjekker om brugeren er logget ind ellers sendes de til login
    const userId = req.session.userId; // Henter brugerens id fra sessionen
    try { 
      await poolConnect; // Opretter forbindelse til databasen
      const result = await pool // Henter konti fra databasen
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT * FROM Accounts WHERE user_id = @userId");
      const accounts = result.recordset; // Henter konti fra databasen
      res.render("accounts", {accounts,userId}); // renderer accounts.ejs med konti og brugerens id
    } catch (err) { // kaster fejl hvis der er problemer med at hente konti
      console.error("Fejl ved hentning af konti:", err);
      res.status(500).send("Noget gik galt ved hentning af konti.");
    }
  });

  router.post("/create-account", async (req, res) => { // Oprettelse af konto
    if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login
    const {name,currency,bank} = req.body; // Henter data fra formularen (det brugeren indtaster)
    const userId = req.session.userId; // Henter brugerens id fra sessionen
    try { // Opretter forbindelse til databasen og indsætter dataen vedr. kontoen
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
      res.redirect("/accounts"); // Sender brugeren tilbage til accounts
    } catch (err) { // Kaster fejl hvis der er problemer med at oprette kontoen
      console.error("Fejl ved oprettelse af konto:", err);
      res.status(500).send("Noget gik galt ved oprettelse af konto.");
    }
  });

  router.post("/deposit", async (req, res) => { // Indbetaling af penge på konto
    const { accountId, amount } = req.body; // Henter data (antal penge) fra formularen (det brugeren indtaster)
    if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login
    const userId = req.session.userId; 
    try { // Opretter forbindelse til databasen og opdaterer balancen på kontoen samt indsætter transaktionen i Transactions tabellen
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
    } catch (err) { // Kaster fejl hvis der er problemer med at indbetale penge
      console.error("Fejl ved indbetaling:", err); 
      res.status(500).send("Noget gik galt ved indbetaling.");
    }
  });

  router.post("/withdraw", async (req, res) => { // udbetaling af penge fra konto
    const {accountId,amount} = req.body; // Henter data (antal penge) fra formularen (det brugeren indtaster)
    if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login
    const userId = req.session.userId;
    try { // Opretter forbindelse til databasen og opdaterer dataen vedr. kontoen
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

  router.post("/close-account", async (req, res) => { // Lukker kontoen
    const {accountId} = req.body;
    if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login
    const userId = req.session.userId;
    try { // Opretter forbindelse til databasen og sætter lukketidspunktet for kontoen
      await poolConnect;
      await pool
        .request()
        .input("accountId", sql.Int, accountId)
        .query("UPDATE Accounts SET closed_at = GETDATE() WHERE id = @accountId");
      res.redirect("/accounts");
    } catch (err) { // Kaster fejl hvis der er problemer med at lukke kontoen
      console.error("Fejl ved lukning af konto:", err); 
      res.status(500).send("Noget gik galt ved lukning af konto.");
    }
  });

  router.post("/reopen-account", async (req, res) => { // Genåbner kontoen
    const {accountId} = req.body; 
    if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kræver login
    const userId = req.session.userId;
    try { // Opretter forbindelse til databasen og sætter lukketidspunktet for kontoen til NULL
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

module.exports = router; // Eksporterer routeren så den er synlig for andre filer