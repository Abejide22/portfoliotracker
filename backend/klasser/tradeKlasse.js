// Her definerer vi klassen Trade, som repræsenterer en handel med aktier.
class tradeKlasse {
  
  // Konstruktøren tager et objekt som parameter, der indeholder oplysninger om handlen.
    constructor(data) {
      this.portfolio = data.portfolio_name;
      this.stock = data.stock_name;
      this.buyPrice = data.buy_price;
      this.sellPrice = data.sell_price;
      this.bought = data.quantity_bought;
      this.sold = data.quantity_sold;
      this.date = data.dato;
    }
  
  // Metode der returnerer hvilken handelstype det er (køb eller salg)
    getType() {
      if (this.bought > 0) return "Køb";
      if (this.sold > 0) return "Salg";
      return "-";
    }

    // Metode der returnerer daten for handlen
    getFormattedDate() {
        if (!this.date) return "Ukendt";
        const dato = new Date(this.date);
        if (isNaN(dato)) return "Ukendt";
        return dato.toISOString().split("T")[0]; // splitter ISO-format og tager kun datoen
      }
  }
  
// Exporterer Trade klassen, så den kan bruges i andre filer
  module.exports = tradeKlasse;

