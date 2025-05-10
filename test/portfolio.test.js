const { expect } = require("chai"); // import chai for at kunne bruge expect
const portfolioRoutes = require("../backend/routes/portfolio_routes"); // import portfolio_routes
const { pool } = require("../backend/database/database"); // import databaseforbindelse

describe("POST /create-portfolio", () => { // laver en test suite for /create-portfolio
  let req, res, createPortfolioRoute; // definerer req, res og createPortfolioRoute som variabler

  beforeEach(() => { // Kør før hver test
    // Mock req og res
    req = { 
      body: {
        portfolioName: "Ny Portefølje", // Mock porteføljenavn
        accountId: 1, // Mock konto-id
      },
      session: {
        userId: 123, // Mock bruger-id
      },
    };
    res = {
      redirectPath: "/portfolios", // Mocker en redirect-sti - ellers vil den være undefined
      statusCode: null, // Mocker statuskoden
      message: null, // Mocker beskeden
      redirect(path) {
        this.redirectPath = path; // Gemmer redirect-stien
      },
      status(code) {
        this.statusCode = code; // Gemmer statuskoden
        return this;
      },
      send(msg) {
        this.message = msg; // Gemmer beskeden
      },
    };

    // Find ruten for /create-portfolio
    createPortfolioRoute = portfolioRoutes.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/create-portfolio" &&
        layer.route.methods.post
    );
  });

  it("skal oprette en ny portefølje og redirecte til /portfolios", async () => {
    // Mock databaseforespørgsler for succesfuld indsættelse
    pool.request = () => {
      const mockRequest = {
        input: () => mockRequest, // Returner samme objekt for at understøtte kædede kald, ellers kaster den typeError
        query: async (query) => { 
          if (query.includes("INSERT INTO Portfolios")) { // Tjekker om forespørgslen er til indsættelse i Portfolios tabellen
            return { rowsAffected: [1] }; // Simuler en vellykket indsættelse
          }
          throw new Error("Uventet forespørgsel"); // Hvis forespørgslen ikke matcher
        },
      };
      return mockRequest;
    };

    // Kald ruten direkte
    await createPortfolioRoute.route.stack[0].handle(req, res);

    // Tjek at redirect blev kaldt korrekt
    expect(res.redirectPath).to.equal("/portfolios");
  });

  it("skal returnere en fejl, hvis databaseforespørgslen fejler", async () => {
    // Mock databaseforespørgsel til at simulere en fejl
    pool.request = () => ({
      input: () => ({
        query: async () => {
          throw new Error("Databasefejl"); 
        },
      }),
    });

    // Kald ruten direkte
    await createPortfolioRoute.route.stack[0].handle(req, res);

    // Tjek at status 500 blev sendt
    expect(res.statusCode).to.equal(500);

    // Tjek at send blev kaldt med en fejlbesked
    expect(res.message).to.equal("Noget gik galt ved oprettelse af portefølje.");
  });
});