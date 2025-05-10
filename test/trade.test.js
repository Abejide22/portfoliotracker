const { expect } = require("chai"); // Importer chai for at kunne bruge expect
const Trade = require("../backend/klasser/Trade"); // Importer Trade-klassen

describe("Trade - getType", () => { // Test suite for getType-metoden
  it("skal returnere korrekt type for en købshandel", () => { // Test for købshandel
    const data = { // Mock data
      portfolio_name: "Portefølje",
      stock_name: "DSV",
      buy_price: 1000,
      sell_price: null,
      quantity_bought: 10,
      quantity_sold: 0,
    };

    const trade = new Trade(data); // Opretter en instans af Trade-klassen med mock data
    expect(trade.getType()).to.equal("Køb"); // Forventer at getType returnerer "Køb"
  });

  it("skal returnere korrekt type for en salgshandel", () => { // Test for salgshandel
    const data = { // Mock data
      portfolio_name: "Portefølje",
      stock_name: "Carlsberg",
      buy_price: 450,
      sell_price: 500,
      quantity_bought: 0,
      quantity_sold: 10,
    };

    const trade = new Trade(data); // Opretter en instans af Trade-klassen med mock data
    expect(trade.getType()).to.equal("Salg"); // Forventer at getType returnerer "Salg"
  });

  it("skal returnere '-' for en handel uden køb eller salg", () => { // Test for en handel uden køb eller salg
    const data = { // Mock data 
      portfolio_name: "Min Portefølje",
      stock_name: "Coloplast",
      buy_price: 600,
      sell_price: null,
      quantity_bought: 0,
      quantity_sold: 0,
    };

    const trade = new Trade(data); // Opretter en instans af Trade-klassen med mock data
    expect(trade.getType()).to.equal("-"); // Forventer at getType returnerer "-"
  });
});