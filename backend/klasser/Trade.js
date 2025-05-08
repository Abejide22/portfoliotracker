class Trade {
    constructor(data) {
      this.portfolio = data.portfolio_name;
      this.stock = data.stock_name;
      this.buyPrice = data.buy_price;
      this.sellPrice = data.sell_price;
      this.bought = data.quantity_bought;
      this.sold = data.quantity_sold;
      this.date = data.created_at || data.sell_date;
    }
  
    getType() {
      if (this.bought > 0) return "Køb";
      if (this.sold > 0) return "Salg";
      return "-";
    }
  
    getFormattedDate() {
        if (!this.date) return "Ukendt";
        const dato = new Date(this.date);
        if (isNaN(dato)) return "Ukendt";
        return dato.toISOString().split("T")[0];
      }
  }
  
  module.exports = Trade;

