const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const Trade = require("../klasser/Trade");
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

    let totalSamletErhvervelsespris = 0;
    let totalSamletForventetVærdi = 0;
    let totalUrealiseretGevinst = 0;

    for (const portfolio of portfolios) {
      const stocksResult = await pool
        .request()
        .input("portfolioId", sql.Int, portfolio.id)
        .query("SELECT * FROM Stocks WHERE quantity > 0 AND portfolio_id = @portfolioId");
  
      const stocks = stocksResult.recordset;

      const stocksAggregated = {};

      stocks.forEach((stock) => {
        if (!stocksAggregated[stock.name]) {
          stocksAggregated[stock.name] = {
            samletAntal: 0,
            samletKøbspris: 0,
          };
        }
        stocksAggregated[stock.name].samletAntal += stock.quantity;
        stocksAggregated[stock.name].samletKøbspris += stock.price;
      });

      const stocksWithGAK = await Promise.all(
        Object.entries(stocksAggregated).map(async ([stockId, data]) => {
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
      // Summer samlet erhvervelsespris, samlet forventet værdi og urealiseret gevinst pr. portefølje
      portfolio.samletErhvervelsespris = 0;
      portfolio.samletForventetVærdi = 0;
      portfolio.urealiseretGevinst = 0;

      for (const aktie of stocksWithGAK) {
          portfolio.samletErhvervelsespris += aktie.samletKøbspris;
          portfolio.samletForventetVærdi += aktie.forventetVærdi;
          portfolio.urealiseretGevinst += aktie.urealiseretGevinst;
      }
      portfolio.totalSamletErhvervelsespris = portfolio.samletErhvervelsespris;
      portfolio.totalSamletForventetVærdi = portfolio.samletForventetVærdi;
      portfolio.totalUrealiseretGevinst = portfolio.urealiseretGevinst;

      totalSamletErhvervelsespris += portfolio.samletErhvervelsespris;
      totalSamletForventetVærdi += portfolio.samletForventetVærdi;
      totalUrealiseretGevinst += portfolio.urealiseretGevinst;
    }

    // Ny: udregn ændring i procent
    const ændring30dage = totalValue30DaysAgo > 0
      ? ((totalValue - totalValue30DaysAgo) / totalValue30DaysAgo) * 100
      : 0;

    const pieChartData = portfolios.map((portfolio) => ({
      name: portfolio.name,
      value: portfolio.totalSamletForventetVærdi || 0
    }));

    res.render("portfolios", {
      portfolios,
      userId,
      totalValue,
      ændring30dage,
      totalSamletErhvervelsespris,
      totalSamletForventetVærdi,
      totalUrealiseretGevinst,
      pieChartData
    });
  } catch (err) {
    console.error("Fejl ved hentning af porteføljer:", err);
    res.status(500).send("Noget gik galt ved hentning af porteføljer.");
  }
});

// Portfolio Transaction - route

router.get("/portfoliotransactions", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  try {
    await poolConnect;

    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT 
          ISNULL(T.sell_date, T.created_at) AS dato,
          T.buy_price, T.sell_price,
          T.quantity_bought, T.quantity_sold,
          P.name AS portfolio_name, 
          S.name AS stock_name
        FROM Trades T
        LEFT JOIN Stocks S ON T.stock_id = S.id
        JOIN Portfolios P ON T.portfolio_id = P.id
        WHERE P.user_id = @user_id
        ORDER BY dato DESC
      `);

    // Her bruger vi for-løkke 
    const trades = [];
    for (let i = 0; i < result.recordset.length; i++) {
      const række = result.recordset[i];
      const tradeObjekt = new Trade(række);  // laver objekt ud fra Trade-klassen
      trades.push(tradeObjekt);              // læg det i listen
    }

    // send objekterne videre til .ejs-filen
    res.render("portfoliotransactions", { transactions: trades });

  } catch (err) {
    console.error("Fejl ved hentning af portefølje-transaktioner:", err);
    res.status(500).send("Fejl ved hentning af portefølje-transaktioner.");
  }
});

module.exports = router;
