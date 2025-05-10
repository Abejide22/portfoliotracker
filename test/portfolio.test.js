const { expect } = require("chai");
const portfolioRoutes = require("../backend/routes/portfolio_routes");
const { pool } = require("../backend/database/database");

describe("POST /create-portfolio", () => {
  let req, res;

  beforeEach(() => {
    // Mock req og res
    req = {
      body: {
        portfolioName: "Min Nye Portefølje", // Mock porteføljenavn
        accountId: 1, // Mock konto-id
      },
      session: {
        userId: 123, // Mock bruger-id
      },
    };
    res = {
      redirectPath: null,
      statusCode: null,
      message: null,
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

    // Mock databaseforespørgsler
    pool.request = () => ({
      input: () => ({
        query: async (query) => {
          if (query.includes("INSERT INTO Portfolios")) {
            return { rowsAffected: [1] }; // Simuler en vellykket indsættelse
          }
          throw new Error("Uventet forespørgsel"); // Hvis forespørgslen ikke matcher
        },
      }),
    });
  });

  it("skal oprette en ny portefølje og redirecte til /portfolios", async () => {
    // Find ruten for /create-portfolio
    const createPortfolioRoute = portfolioRoutes.stack.find(
        (layer) =>
        layer.route &&
        layer.route.path === "/create-portfolio" &&
        layer.route.methods.post
    );

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

    // Find ruten for /create-portfolio
    const createPortfolioRoute = portfolioRoutes.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === "/create-portfolio" &&
        layer.route.methods.post
    );

    // Kald ruten direkte
    await createPortfolioRoute.route.stack[0].handle(req, res);

    // Tjek at status 500 blev sendt
    expect(res.statusCode).to.equal(500);

    // Tjek at send blev kaldt med en fejlbesked
    expect(res.message).to.equal("Noget gik galt ved oprettelse af portefølje.");
  });
});