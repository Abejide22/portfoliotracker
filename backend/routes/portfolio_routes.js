const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const { getDataByKey } = require("../api_test"); // Tilføjet til at hente historiske data
const request = require("request");
const yahooFinance = require("yahoo-finance2").default; // Tilføjet for at kunne hente aktiekurser

router.use(express.urlencoded({ extended: true }));

// Routes

// Portfolio-route

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

router.get("/portfolios", async (req, res) => {
  const userId = req.session.userId;

  try {
    await poolConnect;

    const portfoliosResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Portfolios WHERE user_id = @userId");

    const portfolios = portfoliosResult.recordset;

    let totalValue = 0; // Ny: bruges til at beregne totalværdi i DKK
    let totalValue30DaysAgo = 0; // Ny: bruges til at beregne værdi for 30 dage siden

    for (const portfolio of portfolios) {
      const tradesResult = await pool
        .request()
        .input("portfolioId", sql.Int, portfolio.id)
        .query("SELECT * FROM Trades WHERE portfolio_id = @portfolioId");

      const trades = tradesResult.recordset;

      const stocks = {};

      trades.forEach((trade) => {
        if (!stocks[trade.stock_id]) {
          stocks[trade.stock_id] = {
            samletAntal: 0,
            samletKøbspris: 0,
          };
        }
        stocks[trade.stock_id].samletAntal += trade.quantity_bought;
        stocks[trade.stock_id].samletKøbspris +=
          trade.quantity_bought * trade.buy_price;
      });

      const stocksWithGAK = await Promise.all(
        Object.entries(stocks).map(async ([stockId, data]) => {
          const gak =
            data.samletAntal > 0 ? data.samletKøbspris / data.samletAntal : 0;

          let currentPrice = 0;
          let price30DaysAgo = 0; // Ny: pris for 30 dage siden

          try {
            const quote = await yahooFinance.quote(stockId);
            currentPrice = quote.regularMarketPrice || 0;

            const priceHistory = await getDataByKey(stockId); // Ny: henter sidste 14 dages priser
            if (priceHistory.length > 0) {
              price30DaysAgo = priceHistory[0]; // Bruger ældste datapunkt som "30 dage siden"
            }
          } catch (error) {
            console.error(
              `Fejl ved hentning af aktiekurser for ${stockId}:`,
              error
            );
          }

          const forventetVærdi = currentPrice * data.samletAntal;
          const tidligereVærdi = price30DaysAgo * data.samletAntal; // Ny

          totalValue += forventetVærdi; // Ny
          totalValue30DaysAgo += tidligereVærdi; // Ny

          const urealiseretGevinst = forventetVærdi - data.samletKøbspris;

          return {
            stockId,
            samletAntal: data.samletAntal,
            samletKøbspris: data.samletKøbspris,
            gak,
            currentPrice,
            forventetVærdi,
            urealiseretGevinst,
          };
        })
      );

      portfolio.stocks = stocksWithGAK;
    }

    // Ny: udregn ændring i procent
    const ændring30dage = totalValue30DaysAgo > 0
      ? ((totalValue - totalValue30DaysAgo) / totalValue30DaysAgo) * 100
      : 0;

    res.render("portfolios", {
      portfolios,
      userId,
      totalValue,
      ændring30dage
    });
  } catch (err) {
    console.error("Fejl ved hentning af porteføljer:", err);
    res.status(500).send("Noget gik galt ved hentning af porteføljer.");
  }
});

module.exports = router;
