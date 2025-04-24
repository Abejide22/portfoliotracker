const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session"); // vi tilføjer express-session for at forhindre folk i at tilgå sider uden at være logget ind
const { pool, poolConnect, sql } = require("./database/database");
const routes = require("./routes");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "../views"));

app.use(session({
  secret: 'Løverne', // En hemmelig nøgle til at kryptere sessionen.
  resave: false,
  saveUninitialized: false
}));

app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});
