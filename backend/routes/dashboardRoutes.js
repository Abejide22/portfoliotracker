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
          SELECT t.quantity_bought, t.buy_price, t.quantity_sold, s.price AS current_price
          FROM Trades t
          JOIN Stocks s ON t.stock_id = s.id
          WHERE s.user_id = @userId
        `);
      const trades = tradesResult.recordset;
  
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
      res.render("dashboard", { userId, totalValue, totalRealizedValue, totalUnrealizedValue });
    } catch (err) {
      console.error("Fejl ved hentning af data til dashboard:", err);
      res.status(500).send("Noget gik galt ved hentning af data.");
    }
  });

module.exports = router;