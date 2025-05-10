const { expect } = require("chai");
const express = require("express");
const { pool } = require("../backend/database/database");
const accountRoutes = require("../backend/routes/account_routes");

describe("POST /deposit", () => {
  let req, res, next;

  beforeEach(() => {
    // Mock req, res og next
    req = {
      body: {
        accountId: 1, // Mock konto-id
        amount: 1000.0, // Mock beløb
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
    next = () => {}; // Mock next-metoden

    // Mock databaseforespørgsler
    pool.request = () => ({
      input: () => ({
        query: async (query) => {
          if (query.includes("UPDATE Accounts SET balance = balance +")) {
            return { rowsAffected: [1] }; // Simuler en vellykket opdatering
          }
          if (query.includes("INSERT INTO Transactions")) {
            return { rowsAffected: [1] }; // Simuler en vellykket indsættelse
          }
          throw new Error("Uventet forespørgsel"); // Hvis forespørgslen ikke matcher
        },
      }),
    });
  });

  it("skal indsætte penge på kontoen og opdatere saldoen", async () => {
    // Find ruten for /deposit
    const depositRoute = accountRoutes.stack.find(
      (layer) => layer.route && layer.route.path === "/deposit" && layer.route.methods.post
    );

    // Kald ruten direkte
    await depositRoute.route.stack[0].handle(req, res, next);

    // Tjek at redirect blev kaldt korrekt
    expect(res.redirectPath).to.equal("/accounts");
  });

  it("skal returnere en fejl, hvis der opstår en databasefejl", async () => {
    // Mock databaseforespørgsel til at simulere en fejl
    pool.request = () => ({
      input: () => ({
        query: async () => {
          throw new Error("Databasefejl");
        },
      }),
    });

    // Find ruten for /deposit
    const depositRoute = accountRoutes.stack.find(
      (layer) => layer.route && layer.route.path === "/deposit" && layer.route.methods.post
    );

    // Kald ruten direkte
    await depositRoute.route.stack[0].handle(req, res, next);

    // Tjek at status 500 blev sendt
    expect(res.statusCode).to.equal(500);

    // Tjek at send blev kaldt med en fejlbesked
    expect(res.message).to.equal("Noget gik galt ved indbetaling.");
  });
});