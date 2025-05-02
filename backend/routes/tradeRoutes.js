const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const { getDataByKey } = require("../api_test");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

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
      interval: "1d",
    });

    if (!result || result.length === 0) {
      return res.status(500).json({ error: "No data found for the stock" });
    }

    // Sorter nyeste først
    const sorted = result
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);

    const dates = sorted.map((day) => day.date.toISOString().split("T")[0]);
    const closes = sorted.map((day) => day.close);




    // HÅNDTER KØB AF AKTIE (BEREGN PRIS, OPDATER DATABASE OG SEND BESKED TIL BRUGER)

    let antalAktier = req.body.antalAktier;
    let aktieTickerValgt = req.body.aktieTickerValgt;

    let totalPris = antalAktier * closes[closes.length -1];


    // Returner data som JSON
    res.json({ dates, closes, totalPris });
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
  
    if (stockName) {
      try {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
    
        // Lav perioder for de sidste 30 dage
        const period1 = Math.floor(thirtyDaysAgo.getTime() / 1000);
        const period2 = Math.floor(today.getTime() / 1000); // slut: i dag (nu)
    
        const result = await yahooFinance.historical(stockName, {
          period1,
          period2,
          interval: "1d",
        });
    
        // Sortér nyeste først
        const sorted = result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
        // Mapper datoer og lukkepriser
        const dates = sorted.map((day) => day.date.toISOString().split("T")[0]);
        const closes = sorted.map((day) => day.close);
    
        console.log("Seneste pris:", closes[0], "Dato:", dates[0]); // Debug
      } catch (err) {
        console.error("Fejl ved Yahoo Finance API-kald:", err);
      }
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



// Lav timestamps i sekunder
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

    const latestData = historical[historical.length - 1];

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