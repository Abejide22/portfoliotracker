// -------------------------------------------------------------------------------------- //
// 
// Routes der håndtere aktiehandlen der forgår på trade.ejs siden
//
// -------------------------------------------------------------------------------------- //

const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const request = require("request");


// Routes

const yahooFinance = require("yahoo-finance2").default;


let totalPris = 0; // Total pris på aktierne der skal købes

// POST: modtager stockName fra fetch og returnerer data i JSON
router.post("/trade", async (req, res) => {
  
  const stockName = req.body.stockName; // Får navn på aktie fra trade.ejs siden
  
  if (!stockName) // Tjekker om stockname har en værdi
    {
      return res.status(400).json({ error: "Der mangler at blive valgt en aktie" });
    }
  
  try {
    // Hent aktiedata fra yahoo finance
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1); // Træk 1 år fra
    
    const result = await yahooFinance.historical(stockName, {
      period1: oneYearAgo,
      period2: today,
      interval: "1d", // Daglige datapunkter
    });
    
    if (!result || result.length === 0) {
      return res.status(500).json({ error: "No data found for the stock" });
    }
    
    // Sorter nyeste først (du kan sortere ældste først hvis du ønsker det omvendt)
    const sorted = result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const dates = sorted.map((day) => day.date.toISOString().split("T")[0]);
    const closes = sorted.map((day) => day.close);
    
  
    // HÅNDTER KØB AF AKTIE (BEREGN PRIS, OPDATER DATABASE OG SEND BESKED TIL BRUGER)
    let antalAktier = req.body.antalAktier;
    let aktieTickerValgt = req.body.aktieTickerValgt;
  
    // Den nyeste lukkepris er den første i den sorterede liste
    let nyesteLukkePris = sorted[0].close;
    totalPris = antalAktier * nyesteLukkePris;
  
    // Returner data som JSON
    res.json({ dates, closes, totalPris });

  } catch (err) {
    console.error("Fejl ved Yahoo Finance API-kald:", err);
    res.status(500).json({ error: "Fejl ved hentning af data." });
  }
  

  });



  // ------------------------------------------------------------------------------------//
  //
  // FORETAG KØB AF AKTIE
  //
  // ------------------------------------------------------------------------------------//

  router.post("/trade/buy", async (req, res) => {
    const { porteføljeSelect, aktieTickerValgt, kontoSelect, antalAktier, totalPris } = req.body;
    const userId = req.session.userId;
  
    if (!userId || !aktieTickerValgt || !antalAktier || !totalPris || !porteføljeSelect || !kontoSelect) {
      return res.status(400).send("Mangler oplysninger for at kunne købe");
    }
  
    try {
      await poolConnect;
  
      // Hent portfolio id baseret på porteføljenavnet
      const portfolioResult = await pool
        .request()
        .input("portfolio_name", sql.NVarChar, porteføljeSelect)  // Forbered portfolio_name
        .input("user_id", sql.Int, userId)  // Forbered user_id
        .query(`
          SELECT id 
          FROM Portfolios 
          WHERE name = @portfolio_name AND user_id = @user_id
        `);
  
      if (!portfolioResult.recordset || portfolioResult.recordset.length === 0) {
        return res.status(400).send("Portefølje findes ikke.");
      }
      const portfolioId = portfolioResult.recordset[0].id;


      // Check om der er penge på valgt konto
      const kontoResult = await pool
      .request()
      .input("name", sql.NVarChar, kontoSelect) // tildel name værdien kontoSelect
      .query(`SELECT balance FROM Accounts WHERE name = @name`)

      if (!kontoResult.recordset || kontoResult.recordset.length === 0) {
        return res.status(400).send("Konto findes ikke");
      }
      const kontoBalance = kontoResult.recordset[0].balance;

      if(kontoBalance > totalPris)
        {
        // Udfør INSERT i Stocks-tabellen
        await pool
        .request()
        .input("user_id", sql.Int, userId)  // Input user_id
        .input("portfolio_id", sql.Int, portfolioId)  // Input portfolio_id
        .input("name", sql.NVarChar, aktieTickerValgt)
        .input("type", sql.NVarChar, "aktie")
        .input("quantity", sql.Int, antalAktier)
        .input("price", sql.Decimal(10, 2), totalPris)
        .query(`
        INSERT INTO Stocks (user_id, portfolio_id, name, type, quantity, price, created_at)
        VALUES (@user_id, @portfolio_id, @name, @type, @quantity, @price, GETDATE());
      `);

      await pool
      .request()
      .input("name", sql.NVarChar, kontoSelect)
      .input("amount", sql.Decimal(10, 2), totalPris)
      .query(`UPDATE Accounts SET balance = balance - @amount WHERE name = @name;`);
      


      res.redirect("/portfolios");
      }
      if(kontoBalance < totalPris){
        return res.status(400).send("Du har ikke penge nok");
      }

  
      
  
    } catch (err) {
      console.error("Fejl ved køb af aktie:", err);
      res.status(500).send("Fejl ved køb.");
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
  
    // Henter data om brugerens porteføkjer
    try {
      await poolConnect;
      const portfolioResult = await pool
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT name FROM Portfolios WHERE user_id = @userId"); // Henter data fra portføljer hvor bruger id matcher med det bruger id der er logget ind med
      portfolios = portfolioResult.recordset;
    } catch (err) {
      console.error("Fejl ved hentning af porteføljer:", err);
    }
  
    // Henter data om brugerens kontoer
    try {
      await poolConnect;
      const accountsResult = await pool
        .request()
        .input("userId", sql.Int, userId)
        .query("SELECT name FROM Accounts WHERE user_id = @userId");
      accounts = accountsResult.recordset;
    } catch (err) {
      console.error("Fejl ved hentning af accounts", err);
    }
  
  


    // SEND NUVÆRENDE PRIS FOR AKTIE DATA FOR ALLE AKTIER

    const tickers = [
      "ALMB.CO",
      "AMBU-B.CO",
      "MAERSK-A.CO",
      "MAERSK-B.CO",
      "AQP.CO",
      "ATLA-DKK.CO",
      "BO.CO",
      "BAVA.CO",
      "AOJ-B.CO",
      "CARL-A.CO",
      "CARL-B.CO",
      // "CHR.CO",
      "COLO-B.CO",
      "DANSKE.CO",
      "DEMANT.CO",
      "DFDS.CO",
      "DNORD.CO",
      "DSV.CO",
      "FLS.CO",
      "GMAB.CO",
      "GN.CO",
      "HLUN-B.CO",
      // "HYDRCT.CO",
      "ISS.CO",
      "JYSK.CO",
      "NETC.CO",
      "NKT.CO",
      "NORTHM.CO",
      "NSIS-B.CO",
      "NOVO-B.CO",
      "NTG.CO",
      "ORSTED.CO",  // Kun én forekomst
      "PNDORA.CO",
      "RBREW.CO",
      "ROCK-B.CO",
      "SPNO.CO",
      "STG.CO",
      "STRAP.CO",
      "SPKSJF.CO",
      // "SIM.CO",
      "TRYG.CO",
      "VWS.CO"
    ];
    const nuværendePriser = [];



    const today = new Date();
    const period1 = Math.floor(today.setHours(0, 0, 0, 0) / 1000); // start: i dag 00:00
    const period2 = Math.floor(Date.now() / 1000);                 // slut: nu
    
    for (let i = 0; i < tickers.length; i++) {
      try {
        const historical = await yahooFinance.historical(tickers[i], {
          period1,
          period2,
          interval: '1d',
        });
    
        const todayStr = new Date().toISOString().split('T')[0];
    
        // Find data for i dag, hvis det findes
        let latestData = historical.find(d =>
          d.date.toISOString().split('T')[0] === todayStr
        );
    
        // Fallback til sidste tilgængelige datapunkt, fx gårsdagens
        if (!latestData && historical.length > 0) {
          latestData = historical[historical.length - 1];
        }
    
        nuværendePriser.push({
          symbol: tickers[i],
          price: latestData ? latestData.close : 'N/A',
        });
  } catch (err) {
    console.error(`Error fetching data for ${tickers[i]}`, err);
    nuværendePriser.push({ symbol: tickers[i], price: 'N/A' });
  }
}



res.render("trade", { userId, dates, closes, portfolios, accounts, nuværendePriser });


  });

module.exports = router;