/**
 * Denne fil, `database.js`, håndterer oprettelsen og administrationen af forbindelsen til en Microsoft SQL Server-database.
 * Den bruger `mssql`-pakken og konfigurationsoplysninger fra `config.js` til at etablere forbindelsen.
 
 * Funktionalitet:
 * - Opretter en forbindelsespulje (`pool`) ved hjælp af `sql.ConnectionPool`.
 * - Håndterer fejl i forbindelse med SQL-forbindelsen og logger dem til konsollen.
 * - Eksporterer `sql`, `pool`, og `poolConnect` til brug i andre dele af applikationen.
 
 * Denne fil centraliserer databaseforbindelsen for at forenkle genbrug og vedligeholdelse.
 */

const sql = require('mssql');
const { config } = require('./config');

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on('error', err => {
  console.error('SQL-fejl', err);
});

module.exports = {
  sql,
  pool,
  poolConnect
};
