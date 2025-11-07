const express = require("express"); // Henter express frameworket
const bodyParser = require("body-parser"); // Bruges til at læse data fra formularer
const path = require("path"); // Bruges til at finde stien til filer
const session = require("express-session"); // vi tilføjer express-session for bl.a. at forhindre folk i at tilgå sider uden at være logget ind
const { pool, poolConnect, sql } = require("./database/database"); // Importerer databaseforbindelsen
const routes = require("./routes/allRoutes"); // Importerer ruterne

const app = express(); // Opretter express sereren
const PORT = 3000; // Definerer porten serveren skal køre på

app.set("view engine", "ejs"); // Sætter EJS som templating engine
app.use(express.static(path.join(__dirname, "../public"))); // Sætter public mappen hvor statiske filer ligger
app.use(bodyParser.urlencoded({ extended: true })); // Gør det muligt at læse data fra formularer
app.use(express.json()); // Tilføjer denne linje for at parse JSON-data
app.set("views", path.join(__dirname, "../views")); // Fortæller hvor ejs filerne ligger

app.use(session({
  secret: 'Løverne', // En hemmelig nøgle til at kryptere sessionen.
  resave: false, // Gemmer kun sessionen hvis den er ændret.
  saveUninitialized: false // Sikrer at der ikke oprettes en session for en bruger, der ikke er logget ind.
}));

app.use("/", routes); // Bruger ruterne fra all_routes.js

app.listen(PORT, () => {
  console.log(`Serveren kører på http://localhost:${PORT}`); // Starter selve serveren 
});
22