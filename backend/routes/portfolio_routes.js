const express = require("express"); // Henter express frameworket
const router = express.Router(); // Opretter en router til at håndtere ruter
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const tradeKlasse = require("../klasser/tradeKlasse"); // Importerer Trade-klassen
const { getDataByKey } = require("../api_test.js");
const fs = require("fs");
const request = require("request");
const yahooFinance = require("yahoo-finance2").default; // Tilføjet for at kunne hente aktiekurser

router.use(express.urlencoded({extended: true})); // Gør det muligt at læse data fra formularer

// Portfolio - Routes

// Add Portfolio-route

router.get("/addportfolio", async (req, res) => {
  // Her tjekkes om brugeren er logget ind, hvis ikke sendes brugeren til login siden. Derefter hentes brugerens id fra sessionen
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;

// Her hentes brugerens konti fra databasen, så den kan vælges når der oprettes en portefølje
  try {
    await poolConnect;
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Accounts WHERE user_id = @userId");
    const accounts = result.recordset;

// Her renderes addportfolios.ejs filen og konti sendes med som data
    res.render("addportfolios", { userId, accounts });
  } catch (err) {
    console.error("Fejl ved hentning af konti:", err);
    res.status(500).send("Noget gik galt ved hentning af konti.");
  }
});


// Create Portfolio-route

router.post("/create-portfolio", async (req, res) => {
  // Her læses data fra formularen. Derefter hentes brugerens id fra sessionen
  const { portfolioName, accountId } = req.body;
  const userId = req.session.userId;

  // Her forbindes der til databsen og oprettes en ny portefølje i databasen
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

    // Her sendes brugeren tilbage til portfolios siden
    res.redirect("/portfolios");
  } catch (err) {
    console.error("Fejl ved oprettelse af portefølje:", err);
    res.status(500).send("Noget gik galt ved oprettelse af portefølje.");
  }
});

// Denne route håndterer visningen af brugerens porteføljer og tilhørende aktier.
// Her henter vi porteføljer, beregner deres værdi, og forbereder data til visning og diagrammer.
router.get("/portfolios", async (req, res) => {
  const userId = req.session.userId; // Henter brugerens ID fra sessionen

  try {
    await poolConnect; // Sikrer at der er forbindelse til databasen

    // Henter alle porteføljer tilhørende den aktuelle bruger fra databasen
    const portfoliosResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Portfolios WHERE user_id = @userId");

    const portfolios = portfoliosResult.recordset; // Gemmer portefølje-data i et array

    // variabler til at holde totalværdier på tværs af alle porteføljer
    let totalValue = 0; // Samlet forventet værdi af alle aktier i dag
    let totalValue30DaysAgo = 0; // Samlet forventet værdi for 30 dage siden

    let totalSamletErhvervelsespris = 0; // Samlet købspris for alle aktier
    let totalSamletForventetVærdi = 0; // Samlet nuværende værdi
    let totalUrealiseretGevinst = 0; // Samlet urealiseret gevinst/tab

    // Gennemgår hver portefølje for at beregne værdier og hente aktier
    for (const portfolio of portfolios) {
      // Henter alle aktier med positivt antal for denne portefølje
      const stocksResult = await pool
        .request()
        .input("portfolioId", sql.Int, portfolio.id)
        .query(
          "SELECT * FROM Stocks WHERE quantity > 0 AND portfolio_id = @portfolioId"
        );

      const stocks = stocksResult.recordset; // Liste over aktier i porteføljen

      // Opretter et objekt for at samle antal og købspris pr. aktie (navn)
      const stocksAggregated = {};

      // Gennemgår alle aktier og summerer antal og købspris for hver aktietype
      stocks.forEach((stock) => {
        if (stock.quantity > 0) {
          if (!stocksAggregated[stock.name]) {
            stocksAggregated[stock.name] = {
              samletAntal: 0,
              samletKøbspris: 0,
            };
          }
          stocksAggregated[stock.name].samletAntal += stock.quantity;
          stocksAggregated[stock.name].samletKøbspris += stock.price;
        }
      });

      // For hver aktietype beregnes GAK, nuværende kurs, værdi og gevinst/tab
      const stocksWithGAK = await Promise.all(
        Object.entries(stocksAggregated).map(async ([stockId, data]) => {
          // Gennemsnitlig anskaffelsespris (GAK) for aktien
          const gak =
            data.samletAntal > 0 ? data.samletKøbspris / data.samletAntal : 0;

          let currentPrice = 0; // Nuværende aktiekurs
          let price30DaysAgo = 0; // Kurs for 30 dage siden

          try {
            // Henter nuværende aktiekurs via Yahoo Finance API
            const quote = await yahooFinance.quote(stockId);
            currentPrice = quote.regularMarketPrice || 0;

            // Henter historiske priser for aktien (bruges til at vise udvikling)
            const priceHistory = await getDataByKey(stockId); // Returnerer fx de sidste 14 dages priser
            // Logger prisdata for fejlsøgning og forståelse af datagrundlaget
            console.log(`Prisdata for ${stockId}:`, priceHistory);
            if (priceHistory.length > 0) {
              price30DaysAgo = priceHistory[0]; // Bruger ældste datapunkt som "30 dage siden"
            }
          } catch (error) {
            // Logger fejl hvis der opstår problemer med at hente aktiekurser
            console.error(
              `Fejl ved hentning af aktiekurser for ${stockId}:`,
              error
            );
          }

          // Beregner nuværende værdi af denne aktietype (antal * aktuel kurs)
          const forventetVærdi = currentPrice * data.samletAntal;
          // Beregner værdi for 30 dage siden (antal * kurs for 30 dage siden)
          const tidligereVærdi = price30DaysAgo * data.samletAntal;

          // Lægger værdierne til de samlede totaler for hele brugeren
          totalValue += forventetVærdi;
          totalValue30DaysAgo += tidligereVærdi;

          // Urealiseret gevinst/tab (nuværende værdi minus samlet købspris)
          const urealiseretGevinst = forventetVærdi - data.samletKøbspris;

          // Returnerer aktiedata til videre brug i portefølje-objektet
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

      // Tilføjer listen af aktier (med beregninger) til portefølje-objektet
      portfolio.stocks = stocksWithGAK;
      // Initialiserer summeringsfelter for denne portefølje
      portfolio.samletErhvervelsespris = 0;
      portfolio.samletForventetVærdi = 0;
      portfolio.urealiseretGevinst = 0;

      // Summerer købspris, nuværende værdi og gevinst/tab for alle aktier i porteføljen
      for (const aktie of stocksWithGAK) {
        portfolio.samletErhvervelsespris += aktie.samletKøbspris;
        portfolio.samletForventetVærdi += aktie.forventetVærdi;
        portfolio.urealiseretGevinst += aktie.urealiseretGevinst;
      }
      // Gemmer summeringerne som totalfelter til brug i UI og diagrammer
      portfolio.totalSamletErhvervelsespris = portfolio.samletErhvervelsespris;
      portfolio.totalSamletForventetVærdi = portfolio.samletForventetVærdi;
      portfolio.totalUrealiseretGevinst = portfolio.urealiseretGevinst;

      // Lægger porteføljens summeringer til totalerne for hele brugeren
      totalSamletErhvervelsespris += portfolio.samletErhvervelsespris;
      totalSamletForventetVærdi += portfolio.samletForventetVærdi;
      totalUrealiseretGevinst += portfolio.urealiseretGevinst;
    }

    // Logger den samlede forventede værdi i dag for at kunne følge med i udviklingen
    console.log("Forventet værdi i dag:", totalValue);
    // Logger den samlede værdi for 30 dage siden (bruges til at beregne udvikling)
    console.log("Forventet værdi for 30 dage siden:", totalValue30DaysAgo);
    // Udregner procentvis ændring i porteføljens værdi over de sidste 30 dage.
    // Vises i UI for at give brugeren overblik over udviklingen.
    const ændring30dage =
      totalValue30DaysAgo > 0
        ? ((totalValue - totalValue30DaysAgo) / totalValue30DaysAgo) * 100
        : 0;

    // Logger hele portefølje-data-strukturen til fejlsøgning og overblik
    console.log("Portfolios data:", portfolios);
    // Forbereder data til cirkeldiagram (pie chart): navn og værdi for hver portefølje
    const pieChartData = portfolios.map((portfolio) => ({
      name: portfolio.name,
      value: portfolio.totalSamletForventetVærdi || 0,
    }));
    // Logger rå data til pie chart for at kunne kontrollere værdierne
    console.log("RAW PIE CHART DATA:", pieChartData);
    // Filtrerer kun porteføljer med værdi > 0 (så tomme porteføljer ikke vises i diagrammet)
    const filteredPieChartData = pieChartData.filter((p) => p.value > 0);
    // Logger det filtrerede pie chart data (det, der faktisk sendes til UI)
    console.log("PIE CHART DATA (values > 0):", filteredPieChartData);
    // Endelig log af det data, der sendes til EJS-templaten
    console.log("SENDT PIECHARTDATA TIL EJS:", filteredPieChartData);

    // Renderer 'portfolios'-siden med alle beregnede data
    res.render("portfolios", {
      portfolios,
      userId,
      totalValue,
      ændring30dage,
      totalSamletErhvervelsespris,
      totalSamletForventetVærdi,
      totalUrealiseretGevinst,
      pieChartData: filteredPieChartData,
    });
  } catch (err) {
    // Logger fejl hvis der opstår problemer undervejs
    console.error("Fejl ved hentning af porteføljer:", err);
    res.status(500).send("Noget gik galt ved hentning af porteføljer.");
  }
});

// Portfolio Transaction - route
router.get("/portfoliotransactions", async (req, res) => {
  // Her tjekkes om brugeren er logget ind, hvis ikke sendes brugeren til login siden.
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  try {
    await poolConnect;
    // Her forbindes der til databasen og der hentes alle handler til brugerens porteføljer
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT 
          ISNULL(Trades.sell_date, Trades.created_at) AS dato,
          Trades.buy_price,
          Trades.sell_price,
          Trades.quantity_bought,
          Trades.quantity_sold,
          Portfolios.name AS portfolio_name,
          Stocks.name AS stock_name
        FROM Trades
        LEFT JOIN Stocks ON Trades.stock_id = Stocks.id
        JOIN Portfolios ON Trades.portfolio_id = Portfolios.id
        WHERE Portfolios.user_id = @user_id
        ORDER BY dato DESC;
      `);

    const trades = [];
    for (let i = 0; i < result.recordset.length; i++) { // Gennemgår alle rækker i resultatet
      const række = result.recordset[i]; // henter én række fra databasen
      const tradeObjekt = new tradeKlasse(række); // laver objekt ud fra rækken
      trades.push(tradeObjekt); // lægger objektet i listen
    }

    // send objekterne videre til .ejs-filen
    res.render("portfoliotransactions", { transactions: trades });
  } catch (err) {
    console.error("Fejl ved hentning af portefølje-transaktioner:", err);
    res.status(500).send("Fejl ved hentning af portefølje-transaktioner.");
  }
});

module.exports = router;
