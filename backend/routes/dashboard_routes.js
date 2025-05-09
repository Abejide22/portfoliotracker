const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");
const dashboard_Klasser = require("../klasser/dashboard_klasser");
const yahooFinance = require('yahoo-finance2').default;

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



   const tilfældigAktie = await pool.request()
   // Her defineres en parameter 'userId', som vi beskytter mod SQL injection
   .input("userId", sql.Int, userId)
   // Denne SQL-forespørgsel vælger én tilfældig aktie tilhørende brugeren
  .query(`
    SELECT TOP 1 name 
    FROM Stocks 
    WHERE user_id = @userId 
    ORDER BY NEWID()  -- Sorterer rækker tilfældigt, så vi får en tilfældig en med TOP 1
  `);
  
  // resultatet fra SQL-forespørgslen kommer som et array i recordset
  // selvom vi kun får en række, bliver det stadig et array med et objekt
  const tilfældigAktieResultat = tilfældigAktie.recordset; 




  let priserOgDatoer = []; // objekt der skal indeholde datoer og priser
  try {
  // 1. Hent symbolet på aktien fra den tilfældige aktie valgt tidligere
  const aktie = tilfældigAktieResultat[0]; // fx { name: "AAPL" }
  const aktieSymbol = aktie.name;
  

  // 2. Sæt datointerval: Fra i dag minus 1 år, til i dag
  const dagsDato = new Date();
  const sidsteAar = new Date();
  sidsteAar.setFullYear(dagsDato.getFullYear() - 1);

  // 3. Opsæt forespørgselsindstillinger
  const forespørgsel = {
    period1: sidsteAar,   // Startdato
    period2: dagsDato,    // Slutdato (i dag)
    interval: '1d'        // Dagligt interval
  };

  // 4. Hent historiske data for aktien
  const historiskeData = await yahooFinance.historical(aktieSymbol, forespørgsel);

  // 5. Udtræk dato og slutpris for hver dag
  priserOgDatoer = historiskeData.map(dag => ({
    dato: dag.date.toISOString().split('T')[0], // Kun dato i format "ÅÅÅÅ-MM-DD"
    pris: dag.close                              // Slutkurs den dag (regular market price)
  }));
  
  // 6. Udskriv data
  console.log("Aktiedata for det seneste år:", priserOgDatoer);
}
catch (fejl) {
  console.error("Fejl ved hentning af aktiedata:", fejl);
}
    



    // Send data til dashboardet
    res.render("dashboard", {
      userId,
      totalValue,
      totalUnrealizedValue,
      totalRealizedValue,
      top5Stocks,
      top5ProfitableStocks,
      tilfældigAktieResultat,
      priserOgDatoer
    });
  } catch (err) {
    console.error("Fejl ved hentning af data til dashboard:", err);
    res.status(500).send("Noget gik galt ved hentning af data.");
  }
});

module.exports = router;