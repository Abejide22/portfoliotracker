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

    // Beregn den samlede kontante beholdning
    const totalCash = accounts.length > 0 ? accounts.reduce((sum, account) => sum + account.balance, 0) : 0;

    // Hent brugerens aktier fra Trades og Stocks-tabellerne
    const tradesResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT s.name AS stock_name, p.name AS portfolio_name, 
               t.quantity_bought, t.quantity_sold, t.buy_price, s.price AS current_price
        FROM Trades t
        JOIN Stocks s ON t.stock_id = s.id
        JOIN Portfolios p ON s.portfolio_id = p.id
        WHERE s.user_id = @userId
      `);
    const trades = tradesResult.recordset;

    // Beregn værdien af hver aktie og sorter efter værdi
    const stocksWithValue = trades.map(trade => {
      const quantity = trade.quantity_bought - trade.quantity_sold; // Kun urealiserede aktier
      const value = trade.current_price * quantity;
      return {
        stockName: trade.stock_name,
        portfolioName: trade.portfolio_name,
        value: value.toFixed(2), // Formatér til 2 decimaler
      };
    });

    // Sorter aktierne efter værdi og vælg de 5 største
    const top5Stocks = stocksWithValue.length > 0
      ? stocksWithValue
          .filter(stock => stock.value > 0) // Fjern aktier med 0 værdi
          .sort((a, b) => b.value - a.value) // Sorter i faldende rækkefølge
          .slice(0, 5) // Vælg de 5 største
      : []; // Hvis der ikke er nogen aktier, returner en tom liste

    // Beregn urealiseret profit for hver aktie
    const stocksWithProfit = trades.map(trade => {
      const unrealizedQuantity = trade.quantity_bought - trade.quantity_sold; // Kun urealiserede aktier
      const unrealizedProfit = unrealizedQuantity > 0
        ? (trade.current_price - trade.buy_price) * unrealizedQuantity
        : 0;
      return {
        stockName: trade.stock_name,
        portfolioName: trade.portfolio_name,
        profit: unrealizedProfit.toFixed(2), // Formatér til 2 decimaler
      };
    });

    // Sorter aktierne efter urealiseret profit og vælg de 5 største
    const top5ProfitableStocks = stocksWithProfit.length > 0
      ? stocksWithProfit
          .filter(stock => stock.profit > 0) // Fjern aktier med 0 eller negativ profit
          .sort((a, b) => b.profit - a.profit) // Sorter i faldende rækkefølge
          .slice(0, 5) // Vælg de 5 største
      : []; // Hvis der ikke er nogen aktier, returner en tom liste

    // Beregn den samlede værdi af aktier
    const totalStocksValue = trades.length > 0 ? trades.reduce((sum, trade) => {
      const currentValue = trade.current_price * (trade.quantity_bought - trade.quantity_sold); // Kun urealiserede aktier
      return sum + currentValue;
    }, 0) : 0;

    // Beregn den totale realiserede værdi (fortjeneste/tab)
    const totalRealizedValue = trades.reduce((sum, trade) => {
      if (trade.sell_price) {
        const profitOrLoss = (trade.sell_price - trade.buy_price) * trade.quantity_sold;
        return sum + profitOrLoss;
      }
      return sum;
    }, 0);

    // Beregn den totale urealiserede gevinst/tab
    const totalUnrealizedValue = trades.reduce((sum, trade) => {
      const unrealizedQuantity = trade.quantity_bought - trade.quantity_sold; // Kun urealiserede aktier
      if (unrealizedQuantity > 0) {
        const unrealizedProfitOrLoss = (trade.current_price - trade.buy_price) * unrealizedQuantity;
        return sum + unrealizedProfitOrLoss;
      }
      return sum;
    }, 0);

    // Beregn den samlede værdi (kontanter + aktier)
    const totalValue = totalCash + totalStocksValue;

    // Send data til dashboardet
    res.render("dashboard", {
      userId,
      totalValue,
      totalRealizedValue,
      totalUnrealizedValue,
      top5Stocks,
      top5ProfitableStocks,
    });
  } catch (err) {
    console.error("Fejl ved hentning af data til dashboard:", err);
    res.status(500).send("Noget gik galt ved hentning af data.");
  }
});

module.exports = router;