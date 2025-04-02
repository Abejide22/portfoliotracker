const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { sql, config } = require("./database/dbConfig");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname + "/public")); // Gør CSS brugbar

app.get("/", (req, res) => {
  res.redirect("/index"); // Omdirigerer til /index
});

app.get("/dashboard", (req, res) => {
  res.render("dashboard"); // den henter dashboard.ejs
});

app.get("/index", (req, res) => {
  res.render("index"); // henter index.ejs
});

app.get("/login", (req, res) => {
  res.render("login"); // henter login.ejs
});

app.get("/signup", (req, res) => {
  res.render("signup"); // henter signup.ejs
});

app.get("/portfolios", (req, res) => {
  res.render("portfolios"); // henter portfolios.ejs
});

app.post("/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render("signup", { error: "Kodeordene matcher ikke." });
  }

  try {
    const pool = await sql.connect(config); // Opretter forbindelse til databasen.
    await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password) // plain password
      .query(`
        INSERT INTO Users (username, email, password)
        VALUES (@username, @email, @password)
      `);

    res.redirect("/login");
  } catch (error) {
    console.error("Fejl ved oprettelse:", error);
    res.render("signup", {
      error: "Noget gik galt. Måske findes brugeren allerede?",
    });
  }
});

app.get("/create-account", (req, res) => {
  res.render("accounts"); // viser accounts.ejs
});

app.post("/create-account", async (req, res) => {
  const { name, currency, bank } = req.body;
  const userId = 1; // midlertidigt — vi har ikke login endnu

  try {
    const pool = await sql.connect(config);
    await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("name", sql.NVarChar, name)
      .input("currency", sql.NVarChar, currency)
      .input("bank", sql.NVarChar, bank).query(`
        INSERT INTO Accounts (user_id, name, currency, bank)
        VALUES (@user_id, @name, @currency, @bank)
      `);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Fejl ved konto-oprettelse:", err);
    res.send("Noget gik galt.");
  }
});

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});
