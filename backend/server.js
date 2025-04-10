const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { sql, config } = require("./database/dbConfig");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "../views"));

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

app.get("/accounts", (req, res) => {
  res.render("accounts"); // henter accounts.ejs
});

app.get("/portfolios", (req, res) => {
  res.render("portfolios"); // henter portfolios.ejs
});

app.get("/trade", (req, res) => {
  res.render("trade"); // henter trade.ejs
});

app.post("/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const pool = await sql.connect(config);

    // Tjek om brugernavn eller email allerede findes
    const checkResult = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email).query(`
        SELECT * FROM Users WHERE username = @username OR email = @email
      `);

    if (checkResult.recordset.length > 0) { // Denne kode tjekker, om der er nogen brugere med det samme brugernavn eller email
      return res.status(400).send("Brugernavn eller email findes allerede"); 
    }

    // Indsæt brugeren i databasen
    await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password) // 
      .query(`
        INSERT INTO Users (username, email, password)
        VALUES (@username, @email, @password)
      `);

    res.redirect("/login");
  } catch (err) {
    console.error("Fejl ved brugeroprettelse:", err);
    res.status(500).send("Noget gik galt.");
  }
});

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});
