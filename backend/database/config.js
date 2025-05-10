
/**
 * Denne fil indeholder konfigurationen til at oprette forbindelse til en Microsoft SQL Server-database
 * ved hjælp af mssql-pakken. Konfigurationen specificerer de nødvendige detaljer for at etablere en sikker
 * og korrekt forbindelse til databasen.

 * Filen eksporterer både sql-modulet og konfigurationsobjektet, så de kan genbruges i andre dele af applikationen.
 * Dette gør det muligt at centralisere databaseforbindelsen og undgå redundans i koden.
 */

const sql = require("mssql");

const config = {
  user: "portfolioadm", // serverens brugernavn
  password: "Portfolio2025!", // Serverens password
  server: "portfoliotracker-sql.database.windows.net",
  database: "PortfolioDB",
  options: {
    encrypt: true, // Krypterer forbindelsen for sikkerhed
    enableArithAbort: true // Håndterer aritmetiske fejl korrekt
  }
};

module.exports = {
  sql,
  config
};
