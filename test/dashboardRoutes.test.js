const { expect } = require("chai");
const dashboard_Klasser = require("../backend/klasser/dashboard_klasser");

describe("getTop5Stocks", () => {
  it("skal returnere de 5 mest værdifulde aktier - selv hvis der er flere end 5 aktier", () => {
    // Mock data
    const trades = [
      { stock_name: "DSV", portfolio_name: "Transport", quantity_bought: 1, quantity_sold: 0, current_price: 1500 },
      { stock_name: "Tryg", portfolio_name: "Forsikring", quantity_bought: 1, quantity_sold: 0, current_price: 700 },
      { stock_name: "Danske Bank", portfolio_name: "Finans", quantity_bought: 1, quantity_sold: 0, current_price: 120 },
      { stock_name: "Novo Nordisk", portfolio_name: "Medicinal", quantity_bought: 1, quantity_sold: 0, current_price: 1000 },
      { stock_name: "Carlsberg", portfolio_name: "Bryggeri", quantity_bought: 1, quantity_sold: 0, current_price: 800 },
      { stock_name: "Pandora", portfolio_name: "Smykker", quantity_bought: 1, quantity_sold: 0, current_price: 300 },
    ];

    // Opret en instans af dashboardKlasser
    const dashboard = new dashboard_Klasser(trades, 0);

    // Kalder metoden
    const result = dashboard.getTop5Stocks();

    // Tjek resultatet af hvad der forventes
    expect(result).to.have.lengthOf.at.most(5);
    expect(result[0].stockName).to.equal("DSV"); // DSV er mest værdifulde
    expect(result[1].stockName).to.equal("Novo Nordisk"); // Novo Nordisk er næstmest værdifulde
    expect(result[4].stockName).to.equal("Pandora"); // Pandora er den femte mest værdifulde
  });

  it("skal returnere et tomt array, hvis ingen aktier har værdi", () => {
    // Mock data
    const trades = [
      { stock_name: "DSV", portfolio_name: "Transport", quantity_bought: 0, quantity_sold: 0, current_price: 1500 },
    ];

    // Opret en instans af dashboardKlasser
    const dashboard = new dashboard_Klasser(trades, 0);

    // Kalder metoden
    const result = dashboard.getTop5Stocks();

    // Forventer et array og tjekker, at resultatet (arrayet) er tomt
    expect(result).to.be.an("array").that.is.empty;
  });

  it("skal returnere kun 2 aktier, hvis der kun er 2 aktier", () => {
    // Mock data
    const trades = [
      { stock_name: "DSV", portfolio_name: "Transport", quantity_bought: 1, quantity_sold: 0, current_price: 1500 },
      { stock_name: "Tryg", portfolio_name: "Forsikring", quantity_bought: 1, quantity_sold: 0, current_price: 700 },
    ];

    // Opret en instans af dashboard_Klasser
    const dashboard = new dashboard_Klasser(trades, 0);

    // Kalder metoden
    const result = dashboard.getTop5Stocks();

    // Tjek resultatet af hvad der forventes
    expect(result).to.have.lengthOf(2); // Der er kun 2 aktier
    expect(result[0].stockName).to.equal("DSV"); // DSV er mest værdifulde
    expect(result[1].stockName).to.equal("Tryg"); // Tryg er næstmest værdifulde
  });
});