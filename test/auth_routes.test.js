const { expect } = require("chai");
const express = require("express");
const request = require("supertest");
const authRoutes = require("../backend/routes/auth_routes");

// Mock pool og poolConnect
const pool = {
  request: () => ({
    input: () => ({
      query: async () => ({
        recordset: [{ id: 1, username: "testuser", password: "password123" }],
      }),
    }),
  }),
};
const poolConnect = Promise.resolve();

describe("POST /login", () => {
  let app;

  before(() => {
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Mock res.render() for at undgå fejl
    app.response.render = function (view, options) {
      this.status(200).send(`Rendered view: ${view}, with options: ${JSON.stringify(options)}`);
    };

    // Mock res.redirect() for at simulere en omdirigering
    app.response.redirect = function (url) {
      this.status(302).set("Location", url).end();
    };

    // Mock session middleware
    app.use((req, res, next) => {
      req.session = {}; // Mock session
      next();
    });

    // Registrer authRoutes
    app.use("/", authRoutes);
  });

  it("skal returnere fejl, hvis brugernavn eller adgangskode er forkert", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "wronguser", password: "wrongpassword" });

    expect(response.status).to.equal(200); // Render en side med fejl
    expect(response.text).to.include("Forkert brugernavn eller kodeord");
  });

  it("skal returnere succes, hvis brugernavn og adgangskode er korrekt", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "testuser", password: "password123" });

    expect(response.status).to.equal(302); // Redirect til dashboard
    expect(response.headers.location).to.equal("/dashboard");
  });
});