const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const fs = require("fs");
const { getDataByKey } = require("../api_test");
const request = require("request");

router.use(express.urlencoded({ extended: true }));

// Routes

router.get("/dashboard", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;

  try {
    await poolConnect;

    // Hent brugerens kontante beholdning fra Accounts-tabellen
    const accountsResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT balance FROM Accounts WHERE user_id = @userId");
    const accounts = accountsResult.recordset;

    console.log("=== DEBUGGING INFORMATION ===");
    console.log("Kontantbeholdning hentet:", accounts);

    // Beregn den samlede kontante beholdning
    const totalCash = accounts.length > 0 ? accounts.reduce((sum, account) => sum + account.balance, 0) : 0;

    // Hent brugerens aktier fra Trades og Stocks-tabellerne (kun aktier knyttet til aktive porteføljer)
    const tradesResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
SELECT 
  s.name AS stock_name,
  p.name AS portfolio_name,
  SUM(t.quantity_bought) AS total_quantity_bought,
  SUM(ISNULL(t.quantity_sold, 0)) AS total_quantity_sold,
  (SUM(t.quantity_bought) - SUM(ISNULL(t.quantity_sold, 0))) AS quantity_owned,
  AVG(t.buy_price) AS avg_buy_price,
  MAX(s.price) AS current_price
FROM Trades t
JOIN Stocks s ON t.stock_id = s.id
JOIN Portfolios p ON t.portfolio_id = p.id
WHERE t.quantity_bought IS NOT NULL
  AND p.user_id = @userId
GROUP BY s.name, p.name
HAVING (SUM(t.quantity_bought) - SUM(ISNULL(t.quantity_sold, 0))) > 0;
      `);
    const trades = tradesResult.recordset;
    console.log("Hentede aktier fra databasen:", trades);
    console.log("Aktier hentet:", trades);

    // Gruppér aktier baseret på stockName og læg værdien sammen
    const stocksMap = new Map();

    trades.forEach(trade => {
      const key = `${trade.stock_name}_${trade.portfolio_name}`;
      const quantity = trade.quantity_owned;
      const value = quantity * trade.current_price;

      if (stocksMap.has(key)) {
        const existing = stocksMap.get(key);
        existing.value += value;
        stocksMap.set(key, existing);
      } else {
        stocksMap.set(key, {
          stockName: trade.stock_name,
          portfolioName: trade.portfolio_name,
          value: value,
        });
      }
    });

    const stocksWithValue = Array.from(stocksMap.values()).map(stock => ({
      stockName: stock.stockName,
      portfolioName: stock.portfolioName,
      value: stock.value.toFixed(2),
    }));
    console.log("Aktier med værdi:", stocksWithValue);

    // Sorter aktierne efter værdi og vælg de 5 største
    const top5Stocks = stocksWithValue.length > 0
      ? stocksWithValue
          .filter(stock => stock.value > 0) // Fjern aktier med 0 værdi
          .sort((a, b) => b.value - a.value) // Sorter i faldende rækkefølge
          .slice(0, 5) // Vælg de 5 største
      : []; // Hvis der ikke er nogen aktier, returner en tom liste
      console.log("Top 5 værdifulde aktier:", top5Stocks);

    // Beregn samlet urealiseret profit pr. aktie (grupperet)
    const profitMap = new Map();

    trades.forEach(trade => {
      const key = `${trade.stock_name}_${trade.portfolio_name}`;
      const unrealizedQuantity = trade.quantity_owned;
      const profit = unrealizedQuantity > 0
        ? (trade.current_price - trade.avg_buy_price)
        : 0;

      if (profitMap.has(key)) {
        const existing = profitMap.get(key);
        existing.profit += profit;
        profitMap.set(key, existing);
      } else {
        profitMap.set(key, {
          stockName: trade.stock_name,
          portfolioName: trade.portfolio_name,
          profit: profit,
        });
      }
    });

    const stocksWithProfit = Array.from(profitMap.values()).map(stock => ({
      stockName: stock.stockName,
      portfolioName: stock.portfolioName,
      profit: stock.profit.toFixed(2),
    }));

    // Sorter aktierne efter urealiseret profit og vælg de 5 største
    const top5ProfitableStocks = stocksWithProfit.length > 0
    ? stocksWithProfit
      .filter(stock => stock.profit > 0) // Fjern aktier med 0 eller negativ profit
      .sort((a, b) => b.profit - a.profit) // Sorter i faldende rækkefølge
      .slice(0, 5) // Vælg de 5 største
    : []; // Hvis der ikke er nogen aktier, returner en tom liste

    // Tilføj besked, hvis der ikke er nogen aktier med profit
    const profitMessage = top5ProfitableStocks.length === 0
    ? "Ingen aktier har profit endnu"
    : null;

    // Beregn den samlede værdi af aktier
    const totalStocksValue = trades.length > 0 ? trades.reduce((sum, trade) => {
      const quantityOwned = trade.quantity_owned;
      const currentValue = (trade.current_price || 0) * (quantityOwned > 0 ? quantityOwned : 0);
      return sum + currentValue;
    }, 0) : 0;

    // Beregn den totale realiserede værdi (fortjeneste/tab)
    const totalRealizedValue = trades.reduce((sum, trade) => {
      if (trade.sell_price) {
        const profitOrLoss = (trade.sell_price - trade.avg_buy_price) * trade.total_quantity_sold;
        return sum + profitOrLoss;
      }
      return sum;
    }, 0);

    // Beregn total urealiseret værdi pr. portefølje
    const portfolioMap = new Map();

    trades.forEach(trade => {
      const portfolioName = trade.portfolio_name || 'Ingen portefølje';
      const quantityOwned = trade.quantity_owned;

      if (quantityOwned > 0) {
        if (!portfolioMap.has(portfolioName)) {
          portfolioMap.set(portfolioName, {
            buyValue: 0,
            currentValue: 0,
          });
        }
        const portfolioData = portfolioMap.get(portfolioName);
        portfolioData.buyValue += (trade.avg_buy_price || 0) * quantityOwned;
        portfolioData.currentValue += (trade.current_price || 0) * quantityOwned;
        portfolioMap.set(portfolioName, portfolioData);
      }
    });

    const totalUnrealizedValue = trades.length > 0 ? trades.reduce((sum, trade) => {
      const quantityOwned = trade.quantity_owned;
      if (quantityOwned > 0) {
        const profitPerStock = (trade.current_price - trade.avg_buy_price) * quantityOwned;
        return sum + profitPerStock;
      }
      return sum;
    }, 0) : 0;

    // Beregn den samlede værdi (aktier + kontanter)
    const totalValue = totalStocksValue + totalCash;

    console.log("Samlet kontantbeholdning:", totalCash);
    console.log("Beregnet samlet aktieværdi:", totalStocksValue);
    console.log("Beregnet samlet totalværdi (aktier + kontanter):", totalValue);
    console.log("Beregnet samlet urealiseret værdi:", totalUnrealizedValue);
    console.log("=============================");

    // Send data til dashboardet
    res.render("dashboard", {
      userId,
      totalValue,
      totalRealizedValue,
      totalUnrealizedValue,
      top5Stocks,
      top5ProfitableStocks,
      profitMessage,
    });
  } catch (err) {
    console.error("Fejl ved hentning af data til dashboard:", err);
    res.status(500).send("Noget gik galt ved hentning af data.");
  }
});

module.exports = router;