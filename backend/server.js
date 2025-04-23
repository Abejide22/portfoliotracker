const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { pool, poolConnect, sql } = require("./database/database");
const routes = require("./routes");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "../views"));

app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`);
});
