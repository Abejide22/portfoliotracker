const express = require("express"); // Henter express frameworket
const router = express.Router(); // Opretter en router
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const dashboardKlasser = require("../klasser/dashboardklasser"); // Importerer dashboard-klassen
const yahooFinance = require('yahoo-finance2').default; // Importerer Yahoo Finance API

router.get("/dashboard", async (req, res) => {

  // Tjek om brugeren er logget ind
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;

  try {
    await poolConnect; // Opretter forbindelse til databasen

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
    const dashboard = new dashboardKlasser(trades, totalCash);

    const totalUnrealizedValue = dashboard.getTotalUnrealizedProfit();
    const top5Stocks = dashboard.getTop5Stocks();
    const totalValue = dashboard.getTotalValue();
    const top5ProfitableStocks = dashboard.getTop5ProfitableStocks();


    // ----------------------------------------------------------------------------------
    //
    // BEREGN TOTAL REALISERET VÆRDI
    //
    // ----------------------------------------------------------------------------------

    // Hent alle portfolio ID'er for brugeren
const fåBrugerensPortfolioIder = await pool.request()
  .input("user_id", sql.Int, userId)
  .query(`SELECT id FROM dbo.Portfolios WHERE user_id = @user_id`);

const brugerensPortfolioId = fåBrugerensPortfolioIder.recordset.map(row => row.id);

let aktieDataRealiseretResultat = 0; // Standardværdi, hvis der ingen data er

    if (brugerensPortfolioId.length > 0) {
      // Lav en kommasepareret liste til sql IN-udtryk
      const portfolioIds = brugerensPortfolioId.join(",");

      // Hent summen af buy_price for de fundne portfolio id'er
      const aktieDataRealiseretBuy = await pool.request()
        .query(`SELECT ISNULL(SUM(buy_price), 0) AS total FROM Trades WHERE portfolio_id IN (${portfolioIds}) AND quantity_sold != 0`);

      const aktieDataRealiseretSell = await pool.request()
        .query(`SELECT ISNULL(SUM(sell_price), 0) AS total FROM Trades WHERE portfolio_id IN (${portfolioIds})`);

      const totalBuy = aktieDataRealiseretBuy.recordset[0].total || 0;
      const totalSell = aktieDataRealiseretSell.recordset[0].total || 0;

      aktieDataRealiseretResultat = totalSell - totalBuy;
    } else {
      console.log("Ingen portfolier fundet for brugeren.");
    }

    console.log("Total realiseret aktie-køb:", aktieDataRealiseretResultat);

    // resten af din kode fortsætter uanset om der var portfolier eller ej





    // ----------------------------------------------------------------------------------
    //
    // VÆLG TILFÆLDIG AKTIE
    //
    // -----------------------------------------------------------------------------------

    // Vælger en tilfældig aktie fra brugerens beholdning
    const tilfældigAktie = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
    SELECT TOP 1 name, created_at
    FROM Stocks
    WHERE user_id = @userId
    ORDER BY NEWID();
  `);

    const tilfældigAktieResultat = tilfældigAktie.recordset;

    let tilfældigAktieKøbsdato = 0; // variabel til at gemme købsdatoen

    let priserOgDatoer = []; // array der skal indeholde datoer og priser

    if (tilfældigAktieResultat.length === 0) {
      console.log("Ingen aktier fundet for brugeren.");
    } else {
      tilfældigAktieKøbsdato = tilfældigAktieResultat[0].created_at;
      console.log(tilfældigAktieKøbsdato);

      try { // henter historiske data for den tilfældige aktie
        const aktie = tilfældigAktieResultat[0];
        const aktieSymbol = aktie.name;

        const dagsDato = new Date();
        const sidsteMåned = new Date();
        sidsteMåned.setMonth(dagsDato.getMonth() - 1);

        const forespørgsel = {
          period1: sidsteMåned,
          period2: dagsDato,
          interval: '1d'
        };

        // Hent historiske data for aktien
        const historiskeData = await yahooFinance.historical(aktieSymbol, forespørgsel);

        priserOgDatoer = historiskeData.map(dag => ({
          dato: dag.date.toISOString().split('T')[0],
          pris: dag.close
        }));

        console.log("Aktiedata for den seneste måned:", priserOgDatoer);
      } catch (error) {
        console.error("Fejl under hentning af aktiedata:", error);
      }
    }

    // Programmet fortsætter her uanset om der fandtes en aktie eller ej





    // Send data til dashboardet
    res.render("dashboard", {
      userId, // brugerens id
      totalValue, // total værdi
      totalUnrealizedValue, // total urealiseret værdi
      top5Stocks, // de 5 mest værdifulde aktier
      top5ProfitableStocks, // vis de 5 mest profitable aktier
      tilfældigAktieResultat, // navn på aktie der er blevet valgt
      priserOgDatoer, // priser og datoer på valgt aktie
      tilfældigAktieKøbsdato,  // dato for hvornår aktien er blevet købt
      aktieDataRealiseretResultat, // total realiseret aktie-køb
    });
  } catch (err) {
    console.error("Fejl ved hentning af data til dashboard:", err);
    res.status(500).send("Noget gik galt ved hentning af data.");
  }
});

module.exports = router;