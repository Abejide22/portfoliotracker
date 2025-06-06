// -------------------------------------------------------------------------------------- //
// 
// Routes der håndtere aktiehandlen der forgår på trade.ejs siden
//
// -------------------------------------------------------------------------------------- //

const express = require("express"); // Henter express frameworket
const router = express.Router(); //
const { pool, poolConnect, sql } = require("../database/database"); // Importerer databaseforbindelsen
const fs = require("fs");
const request = require("request");


// Routes

const yahooFinance = require("yahoo-finance2").default; // Importer Yahoo Finance API


let totalPris = 0; // Total pris på aktierne der skal købes

// POST: modtager stockName fra fetch og returnerer data i JSON
router.post("/trade", async (req, res) => {
  
  const stockName = req.body.stockName; // Får navn på aktie fra trade.ejs siden
  
  if (!stockName) // Tjekker om stockname har en værdi
    {
      return res.status(400).json({ error: "Der mangler at blive valgt en aktie" });
    }
  
  try {
    // Hent aktiedata fra yahoo finance
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1); // Træk 1 år fra
    
    const result = await yahooFinance.historical(stockName, {
      period1: oneYearAgo,
      period2: today,
      interval: "1d", // Daglige datapunkter
    });
    
    if (!result || result.length === 0) {
      return res.status(500).json({ error: "No data found for the stock" });
    }
    
    // Sorter nyeste først (du kan sortere ældste først hvis du ønsker det omvendt)
    const sorted = result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const dates = sorted.map((day) => day.date.toISOString().split("T")[0]);
    const closes = sorted.map((day) => day.close);
    
  
    // HÅNDTER KØB AF AKTIE (BEREGN PRIS, OPDATER DATABASE OG SEND BESKED TIL BRUGER)
    let antalAktier = req.body.antalAktier;
    let aktieTickerValgt = req.body.aktieTickerValgt;
  
    // Den nyeste lukkepris er den første i den sorterede liste
    let nyesteLukkePris = sorted[0].close;
    totalPris = antalAktier * nyesteLukkePris;
  
    // Returner data som JSON
    res.json({ dates, closes, totalPris });

  } catch (err) {
    console.error("Fejl ved Yahoo Finance API-kald:", err);
    res.status(500).json({ error: "Fejl ved hentning af data." });
  }
  

  });



  // ------------------------------------------------------------------------------------//
  //
  // FORETAG KØB AF AKTIE
  //
  // ------------------------------------------------------------------------------------//

  router.post("/trade/buy", async (req, res) => {
    // Her modtager vi data fra formularen på trade.ejs og derefter bliver brugerens ID hentet fra sessionen og gemt i en variabel
    const { porteføljeSelect, aktieTickerValgt, kontoSelect, antalAktier, totalPris } = req.body;
    const userId = req.session.userId;
  
    // Tjekker om alle nødvendige oplysninger er givet, hvis ikke returnerer vi en fejl
    if (!userId || !aktieTickerValgt || !antalAktier || !totalPris || !porteføljeSelect || !kontoSelect) {
      return res.status(400).send("Mangler oplysninger for at kunne købe");
    }
  
    try {
      await poolConnect; // Opretter forbindelse til databasen
  
      // Her hentes portefølje ID fra databasen baseret på brugerens ID og den valgte portefølje
      const portfolioResult = await pool
        .request()
        .input("portfolio_name", sql.NVarChar, porteføljeSelect)  // Forbered portfolio_name
        .input("user_id", sql.Int, userId)  // Forbered user_id
        .query(`
          SELECT id 
          FROM Portfolios 
          WHERE name = @portfolio_name AND user_id = @user_id
        `);
        
        // Tjekker om porteføljen findes
      if (!portfolioResult.recordset || portfolioResult.recordset.length === 0) {
        return res.status(400).send("Portefølje findes ikke.");
      }
      // Henter portefølje ID
      const portfolioId = portfolioResult.recordset[0].id;


      // Her finder vi balancen på den valgte konto
      const kontoResult = await pool
      .request()
      .input("name", sql.NVarChar, kontoSelect) // tildel name værdien kontoSelect
      .query(`SELECT balance FROM Accounts WHERE name = @name`)

      // Tjekker om kontoen findes
      if (!kontoResult.recordset || kontoResult.recordset.length === 0) {
        return res.status(400).send("Konto findes ikke"); // 
      }
      const kontoBalance = kontoResult.recordset[0].balance;

      // Tjekker om der er penge nok på kontoen til at købe aktien
      if(kontoBalance > totalPris)
        {
          // Tjekker om brugeren allerede ejer aktien på porteføljen
          const existingStockResult = await pool
          .request()
          .input("user_id", sql.Int, userId)
          .input("portfolio_id", sql.Int, portfolioId)
          .input("name", sql.NVarChar, aktieTickerValgt)
          .query(`
            SELECT id, quantity, price FROM Stocks
            WHERE user_id = @user_id AND portfolio_id = @portfolio_id AND name = @name
          `);
          
          let stockId;

          // Hvis aktien allerede findes, opdaterer vi den
          if (existingStockResult.recordset.length > 0) {
            const existingStock = existingStockResult.recordset[0];
            const updatedQuantity = existingStock.quantity + antalAktier;
            const updatedPrice = parseFloat(existingStock.price) + parseFloat(totalPris);

          // Opdaterer aktien i Stocks-tabellen
          await pool.request()
            .input("id", sql.Int, existingStock.id)
            .input("quantity", sql.Int, updatedQuantity)
            .input("price", sql.Decimal(10, 2), updatedPrice)
            .query(`
              UPDATE Stocks SET quantity = @quantity, price = @price WHERE id = @id
            `);

          stockId = existingStock.id;
        }
        else {
          // Hvis aktien ikke findes, indsætter vi den i Stocks-tabellen
          await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("portfolio_id", sql.Int, portfolioId)
            .input("name", sql.NVarChar, aktieTickerValgt)
            .input("type", sql.NVarChar, "aktie")
            .input("quantity", sql.Int, antalAktier)
            .input("price", sql.Decimal(10, 2), totalPris)
            .query(`
              INSERT INTO Stocks (user_id, portfolio_id, name, type, quantity, price, created_at)
              VALUES (@user_id, @portfolio_id, @name, @type, @quantity, @price, GETDATE());
            `);

          // Her finder vi aktie ID'et for den nyoprettede aktie
          const stockResult = await pool
            .request()
            .input("user_id", sql.Int, userId)
            .input("portfolio_id", sql.Int, portfolioId) 
            .input("name", sql.NVarChar, aktieTickerValgt)
            .query(`
              SELECT id FROM Stocks 
              WHERE user_id = @user_id AND portfolio_id = @portfolio_id AND name = @name
            `);
          
          stockId = stockResult.recordset[0].id;
        }

        // Gemmer aktien i trades tabellen som et køb
        await pool
        .request()
        .input("portfolio_id", sql.Int, portfolioId)
        .input("stock_id", sql.Int, stockId)
        .input("buy_price", sql.Decimal(18, 2), totalPris / antalAktier)
        .input("sell_price", sql.Decimal(18, 2), null) // vigtigt!
        .input("quantity_bought", sql.Int, antalAktier)
        .input("quantity_sold", sql.Int, 0) // vigtigt!
        .query(`
          INSERT INTO Trades (portfolio_id, stock_id, buy_price, sell_price, quantity_bought, quantity_sold, created_at)
          VALUES (@portfolio_id, @stock_id, @buy_price, @sell_price, @quantity_bought, @quantity_sold, GETDATE());
        `);
        
        // Opdater saldoen på kontoen
        await pool
        .request()
        .input("name", sql.NVarChar, kontoSelect)
        .input("amount", sql.Decimal(10, 2), totalPris)
        .query(`UPDATE Accounts SET balance = balance - @amount WHERE name = @name;`);
        
        res.redirect("/portfolios"); // Redirect til porteføljeoversigt
        }

        // Hvis der ikke er penge nok på kontoen, vis en fejlbesked
        if(kontoBalance < totalPris)
          {
            let IkkeNokPenge = true;
            res.render("trade", { IkkeNokPenge });
          }
        }
        catch (err)
        {
          console.error("Fejl ved køb af aktie:", err);
          res.status(500).send("Fejl ved køb.");
        }
      });


      // ------------------------------------------------------------------------------------//
      // 
      // FORETAG SALG AF AKTIE
      //
      // ------------------------------------------------------------------------------------//
      router.post("/trade/sell", async (req, res) => {
        // Her modtager vi data fra formularen på trade.ejs og derefter bliver brugerens ID hentet fra sessionen og gemt i en variabel
        const { porteføljeSelect, aktieTickerValgt, kontoSelect, antalAktier, totalPris } = req.body;
        const userId = req.session.userId;
        
        // Tjekker om alle nødvendige oplysninger er givet, hvis ikke returnerer vi en fejl
        if (!userId || !aktieTickerValgt || !antalAktier || !totalPris || !porteføljeSelect || !kontoSelect) {
          return res.status(400).send("Mangler oplysninger for at kunne sælge");
        }
        
        try {
          await poolConnect; // Opretter forbindelse til databasen

          // Tjekker om aktien findes i Stocks-tabellen og finder portefølje ID
          const portfolioResult = await pool
          .request()
          .input("portfolio_name", sql.NVarChar, porteføljeSelect)
          .input("user_id", sql.Int, userId)
          .query(`SELECT id FROM Portfolios WHERE name = @portfolio_name AND user_id = @user_id`);
          
          // Tjekker om porteføljen findes
          if (!portfolioResult.recordset.length) {
            return res.status(400).send("Portefølje findes ikke.");
          }
          
          // Gemmer portefølje ID
          const portfolioId = portfolioResult.recordset[0].id;
          
          // Find aktien brugeren forsøger at sælge fra Stocks-tabellen
          const stockResult = await pool
          .request()
          .input("user_id", sql.Int, userId)
          .input("portfolio_id", sql.Int, portfolioId)
          .input("name", sql.NVarChar, aktieTickerValgt)
          .query(`SELECT TOP 1 id, quantity, price FROM Stocks 
            WHERE user_id = @user_id AND portfolio_id = @portfolio_id AND name = @name AND quantity > 0
            ORDER BY created_at DESC`);
            
            // Tjekker om aktien findes
            if (!stockResult.recordset.length)
              {
                return res.status(400).send("Du ejer ikke denne aktie i den valgte portefølje.");
              }
              
              // Gemmer aktien
              const stock = stockResult.recordset[0];
              
              // Tjekker om brugeren ejer nok aktier til at sælge
              if (stock.quantity < antalAktier) {
                return res.status(400).send("Du ejer ikke nok aktier til at sælge.");
              }
              
              // Beregner ny beholdning og gennemsnitlig købspris
              const nyBeholdning = stock.quantity - antalAktier;
              const averageBuyPrice = parseFloat((stock.price / stock.quantity).toFixed(2)); // Gennemsnitlig købspris med 2 decimaler
              
              
              // Her sætter vi slaget ind i trades-tabellen
              await pool
              .request()
              .input("portfolio_id", sql.Int, portfolioId)
              .input("stock_id", sql.Int, stock.id)
              .input("buy_price", sql.Decimal(18, 2), averageBuyPrice)
              .input("sell_price", sql.Decimal(18, 2), totalPris / antalAktier)
              .input("quantity_bought", sql.Int, 0)
              .input("quantity_sold", sql.Int, antalAktier)
              .query(`INSERT INTO Trades (portfolio_id, stock_id, buy_price, sell_price, quantity_bought, quantity_sold, sell_date, created_at)
                VALUES (@portfolio_id, @stock_id, @buy_price, @sell_price, @quantity_bought, @quantity_sold, GETDATE(), GETDATE());`);

                // Hvis brugeren har solgt alle aktier så tjek om aktien har handler i Trades-tabellen
                if (nyBeholdning === 0)
                  {
                    const checkTrades = await pool
                    .request()
                    .input("stock_id", sql.Int, stock.id)
                    .query(`SELECT COUNT(*) AS antal FROM Trades WHERE stock_id = @stock_id`);
                    
                    const harTrades = checkTrades.recordset[0].antal > 0;

                    // Hvis aktien ikke har handler i Trades-tabellen, så slet den fra Stocks-tabellen ellers opdater den
                     
                    if (!harTrades) {
                      await pool
                      .request()
                      .input("id", sql.Int, stock.id)
                      .query(`DELETE FROM Stocks WHERE id = @id`);
                    }
                    else {
                      await pool
                      .request()
                      .input("id", sql.Int, stock.id)
                      .query(`UPDATE Stocks SET quantity = 0 WHERE id = @id`);
                    }
                  }
                  else {
                    // Hvis stocks-tabellen stadig har aktier, så opdaterer vi den
                    const nyPris = parseFloat((averageBuyPrice * nyBeholdning).toFixed(2));
                    
                    await pool
                    .request()
                    .input("quantity", sql.Int, nyBeholdning)
                    .input("price", sql.Decimal(10, 2), nyPris)
                    .input("id", sql.Int, stock.id)
                    .query(`UPDATE Stocks SET quantity = @quantity, price = @price WHERE id = @id`);
                  }
                  
                  // Opdater saldoen på kontoen
                  await pool
                  .request()
                  .input("name", sql.NVarChar, kontoSelect)
                  .input("amount", sql.Decimal(10, 2), totalPris)
                  .query(`UPDATE Accounts SET balance = balance + @amount WHERE name = @name;`);
                  
                  
                  // Find konto ID'et for den valgte konto
                  const kontoResult = await pool
                  .request()
                  .input("name", sql.NVarChar, kontoSelect)
                  .query(`SELECT id FROM Accounts WHERE name = @name`);
                  
                  const kontoId = kontoResult.recordset[0].id;

                  // Her indsætter vi salget i Transactions-tabellen
                  await pool
                  .request()
                  .input("account_id", sql.Int, kontoId)
                  .input("amount", sql.Decimal(18, 2), totalPris)
                  .input("description", sql.NVarChar, `Salg af ${antalAktier} x ${aktieTickerValgt}`)
                  .input("transaction_type", sql.NVarChar, "credit")
                  .query(`INSERT INTO Transactions (account_id, amount, description, transaction_type, created_at)
                    VALUES (@account_id, @amount, @description, @transaction_type, GETDATE());
                    `);
                    res.status(200).json({ message: "Salg gennemført" });
                  
                  }
                  catch (err) 
                  {
                    console.error("Fejl ved salg af aktie:", err);
                    res.status(500).send("Fejl ved salg.");
                  }
                });
                
                
      // GET viser trade.ejs og initialiserer siden
      router.get("/trade", async (req, res) => {
        if (!req.session.userId)
          {
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
          } 
          catch (err)
          {
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
          }
          catch (err) {
            console.error("Fejl ved hentning af accounts", err);
          }

          // SEND NUVÆRENDE PRIS FOR AKTIE DATA FOR ALLE AKTIER
          const tickers = ["ALMB.CO","AMBU-B.CO","MAERSK-A.CO","MAERSK-B.CO","AQP.CO","ATLA-DKK.CO","BO.CO","BAVA.CO","AOJ-B.CO",
            "CARL-A.CO","CARL-B.CO","COLO-B.CO","DANSKE.CO","DEMANT.CO","DFDS.CO","DNORD.CO","DSV.CO","FLS.CO","GMAB.CO","GN.CO",
            "HLUN-B.CO","ISS.CO","JYSK.CO","NETC.CO","NKT.CO","NORTHM.CO","NSIS-B.CO","NOVO-B.CO","NTG.CO","ORSTED.CO","PNDORA.CO",
            "RBREW.CO","ROCK-B.CO","SPNO.CO","STG.CO","STRAP.CO","SPKSJF.CO","TRYG.CO","VWS.CO"];
    
            const nuværendePriser = [];
            for (let i = 0; i < tickers.length; i++) { // Loop der køre igennem alle aktierne i tickers arrayet
              try {
                // Henter den seneste markedspris
                const quote = await yahooFinance.quote(tickers[i]);

                nuværendePriser.push({ // Her gemmer vi aktie data i nuværendePriser arrayet
                symbol: tickers[i],
                price: quote?.regularMarketPrice ?? 'Ingen data', // Hvis ingen data, så skriv ingen data
                });
              }
              catch (err)
              {
                // Udtræk statuskode hvis tilgængelig
                let statusKode = err?.statusCode || null;
                console.error(`Fejl ved hentning af data for ${tickers[i]}`, {
                message: err.message,
                statusKode,});
                        
                let errorBesked = 'Fejl';
                if (statusKode === 404)
                {
                  errorBesked = 'Ticker ikke fundet';
                }
                else if (statusKode === 429)
                {
                  errorBesked = 'Klientside – for mange forespørgsler';
                }
                else if (statusKode === 500)
                {
                  errorBesked = 'Serverfejl';
                }
                nuværendePriser.push({symbol: tickers[i], price: errorBesked,}); // indsætter værdierne for ticker og pris i nuværendePriser arrayet
              }
            }
            res.render("trade", { userId, dates, closes, portfolios, accounts, nuværendePriser });
          });
          module.exports = router;