const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));


app.use(express.static(__dirname + '/public')); // Gør CSS brugbar


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




app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});

