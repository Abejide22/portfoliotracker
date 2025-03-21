const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/dashboard", (req, res) => {
  res.render("dashboard"); // Renderer "views/dashboard.ejs"
});

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});
