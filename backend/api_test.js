// api_test.js
const yahooFinance = require('yahoo-finance2').default;

async function retrieveStockData() {
    try {
        const result = await yahooFinance.quote("AAPL");
        return result; // vigtigt: returnér data!
    } catch (error) {
        console.error("Fejl i retrieveStockData:", error);
        return null; // fallback hvis noget fejler
    }
}

module.exports = retrieveStockData; // eksporter funktionen