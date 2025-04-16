
// database.js
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
