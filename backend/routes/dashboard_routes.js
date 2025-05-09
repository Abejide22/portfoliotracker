const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const dashboard_Klasser = require("../klasser/dashboard_klasser");

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
        SELECT s.name AS stock_name, 
              ISNULL(p.name, 'Ingen portefølje') AS portfolio_name, 
              ISNULL(s.quantity, 0) AS quantity_bought, 
              ISNULL(t.quantity_sold, 0) AS quantity_sold, 
              ISNULL(t.buy_price, 0) AS buy_price, 
              ISNULL(t.sell_price, 0) AS sell_price, 
              ISNULL(s.price, 0) AS price, 
              ISNULL(s.price, 0) AS current_price
        FROM Stocks s
        LEFT JOIN Trades t ON t.stock_id = s.id
        LEFT JOIN Portfolios p ON s.portfolio_id = p.id
        WHERE s.user_id = @userId; -- Hent aktier for den pågældende bruger
      `);
    const trades = tradesResult.recordset;

    // Brug dashboard_klasser
    const dashboard = new dashboard_Klasser(trades, totalCash);

    const totalUnrealizedValue = dashboard.getTotalUnrealizedProfit();
    console.log("Total Unrealized Profit:", totalUnrealizedValue);
    const top5Stocks = dashboard.getTop5Stocks();
    const totalValue = dashboard.getTotalValue();
    const totalRealizedValue = dashboard.getTotalRealizedValue();
    const top5ProfitableStocks = dashboard.getTop5ProfitableStocks();

    // Send data til dashboardet
    res.render("dashboard", {
      userId,
      totalValue,
      totalUnrealizedValue,
      totalRealizedValue,
      top5Stocks,
      top5ProfitableStocks,
    });
  } catch (err) {
    console.error("Fejl ved hentning af data til dashboard:", err);
    res.status(500).send("Noget gik galt ved hentning af data.");
  }
});

module.exports = router;