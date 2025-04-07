const sql = require("mssql");

const config = {
  user: "portfolioadm", // serverens brugernavn
  password: "Portfolio2025!", // Serverens password
  server: "portfoliotracker-sql.database.windows.net",
  database: "PortfolioDB",
  options: {
    encrypt: true,
    enableArithAbort: true 
  }
};

module.exports = {
  sql,
  config
}; // Eksporterer config-objektet