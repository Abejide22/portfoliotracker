const { expect } = require("chai"); // Importer chai for at kunne bruge expect
const Trade = require("../backend/klasser/Trade"); // Importer Trade-klassen

describe("Trade", () => { // Test suite for Trade-klassen
  it("skal korrekt initialisere en Trade-instans", () => { // Test for korrekt initialisering
    const data = {
      portfolio_name: "Min Portefølje",
      stock_name: "Apple",
      buy_price: 150,
      sell_price: null,
      quantity_bought: 10,
      quantity_sold: 0,
      dato: "2025-05-10T12:00:00Z",
    };

    const trade = new Trade(data);

    expect(trade.portfolio).to.equal("Min Portefølje");
    expect(trade.stock).to.equal("Apple");
    expect(trade.buyPrice).to.equal(150);
    expect(trade.sellPrice).to.be.null;
    expect(trade.bought).to.equal(10);
    expect(trade.sold).to.equal(0);
    expect(trade.date).to.equal("2025-05-10T12:00:00Z");
  });

  it("skal returnere korrekt type for en købshandel", () => {
    const data = {
      portfolio_name: "Min Portefølje",
      stock_name: "Apple",
      buy_price: 150,
      sell_price: null,
      quantity_bought: 10,
      quantity_sold: 0,
      dato: "2025-05-10T12:00:00Z",
    };

    const trade = new Trade(data);
    expect(trade.getType()).to.equal("Køb");
  });

  it("skal returnere korrekt type for en salgshandel", () => {
    const data = {
      portfolio_name: "Min Portefølje",
      stock_name: "Apple",
      buy_price: 150,
      sell_price: 200,
      quantity_bought: 0,
      quantity_sold: 10,
      dato: "2025-05-10T12:00:00Z",
    };

    const trade = new Trade(data);
    expect(trade.getType()).to.equal("Salg");
  });

  it("skal returnere korrekt formateret dato", () => {
    const data = {
      portfolio_name: "Min Portefølje",
      stock_name: "Apple",
      buy_price: 150,
      sell_price: null,
      quantity_bought: 10,
      quantity_sold: 0,
      dato: "2025-05-10T12:00:00Z",
    };

    const trade = new Trade(data);
    expect(trade.getFormattedDate()).to.equal("2025-05-10");
  });

  it("skal returnere 'Ukendt' for ugyldig dato", () => {
    const data = {
      portfolio_name: "Min Portefølje",
      stock_name: "Apple",
      buy_price: 150,
      sell_price: null,
      quantity_bought: 10,
      quantity_sold: 0,
      dato: "ugyldig-dato",
    };

    const trade = new Trade(data);
    expect(trade.getFormattedDate()).to.equal("Ukendt");
  });
});