class dashboardKlasser {
  constructor(trades, totalCash) {
    this.trades = trades; // Gem trades som en egenskab i klassen
    this.totalCash = totalCash; // Gem kontantbeholdning som en egenskab
  }

  getTop5Stocks() {
    const stocksWithValue = this.trades
      .filter(trade => (trade.quantity_bought - trade.quantity_sold) > 0) // Kun urealiserede aktier
      .map(trade => { // omdanner trades til et format med aktienavn, porteføljenavn og værdi
        const value = trade.current_price; // Beregn værdien af aktien
        return {
          stockName: trade.stock_name,
          portfolioName: trade.portfolio_name,
          value: parseFloat(value.toFixed(2)), // Formatér til 2 decimaler som tal
        };
      });

    const top5Stocks = stocksWithValue.length > 0
      ? stocksWithValue
          .filter(stock => stock.value > 0) // Fjern aktier med 0 værdi
          .sort((a, b) => b.value - a.value) // Sorter i faldende rækkefølge
          .slice(0, 5) // Vælg de 5 største
      : []; // Hvis der ikke er nogen aktier, returner en tom liste

    return top5Stocks;
  }

  // Beregn den samlede kontante beholdning
  getTotalCash(accounts) {
    if (!accounts || accounts.length === 0) {
      console.error("Accounts er tom eller ikke defineret:", accounts);
      return 0; // Returner 0, hvis accounts er tom
    }

    // Beregn summen af balance-felterne
    const totalCash = accounts.reduce((sum, account) => {
      if (account.balance !== undefined && account.balance !== null) {
        return sum + account.balance;
      } else {
        console.error("Account mangler balance-felt:", account);
        return sum;
      }
    }, 0);

    return totalCash; // Returner den samlede kontante beholdning
  }

  // Beregn den totale urealiserede profit - virker ikke korrekt. 
  getTotalUnrealizedProfit() {
    let totalCost = 0; // Samlet købspris for alle aktier
    let totalCurrentValue = 0; // Samlet nuværende værdi for alle aktier

    this.trades.forEach(trade => {
      // Beregn antallet af aktier, der stadig er i besiddelse
      const remainingQuantity = trade.quantity_bought - trade.quantity_sold;

      if (remainingQuantity > 0) {
        // Beregn den samlede købspris for de tilbageværende aktier
        const costForTrade = trade.price * remainingQuantity;

        // Beregn den nuværende værdi for de tilbageværende aktier
        const currentValueForTrade = trade.current_price * remainingQuantity;

        // Tilføj til de samlede værdier
        totalCost += costForTrade;
        totalCurrentValue += currentValueForTrade;
      }
    });

    // Beregn urealiseret gevinst/tab
    const unrealizedProfit = totalCurrentValue - totalCost;

    return unrealizedProfit; // Returner resultatet
  }

  // Beregn de 5 mest profitable aktier
  getTop5ProfitableStocks() {
    const stocksWithProfit = this.trades.map(trade => {
      const unrealizedQuantity = trade.quantity_bought - trade.quantity_sold; // Kun urealiserede aktier
      const unrealizedProfit = unrealizedQuantity > 0
        ? (trade.current_price - trade.price) * unrealizedQuantity // Beregn profit for urealiserede aktier
        : 0;
      return {
        stockName: trade.stock_name,
        portfolioName: trade.portfolio_name,
        profit: parseFloat(unrealizedProfit.toFixed(2)), // Formatér til 2 decimaler som tal
      };
    });

    const top5ProfitableStocks = stocksWithProfit.length > 0
      ? stocksWithProfit
          .filter(stock => stock.profit > 0) // Fjern aktier med 0 eller negativ profit
          .sort((a, b) => b.profit - a.profit) // Sorter i faldende rækkefølge
          .slice(0, 5) // Vælg de 5 største
      : []; // Hvis der ikke er nogen aktier, returner en tom liste

    return top5ProfitableStocks;
  }

  // Beregn den samlede værdi (aktier + kontanter)
  getTotalValue() {
    const totalStocksValue = this.trades.reduce((sum, trade) => {
      const unrealizedQuantity = trade.quantity_bought - trade.quantity_sold; // Kun urealiserede aktier
      if (unrealizedQuantity > 0) {
        const currentValueForTrade = trade.current_price; // Nuværende værdi for denne aktie
        return sum + currentValueForTrade;
      }
      return sum;
    }, 0);

    return this.totalCash + totalStocksValue; // Samlet værdi = kontanter + aktier
  }
}

module.exports = dashboardKlasser; // Eksporter klassen, så den kan bruges i andre filer