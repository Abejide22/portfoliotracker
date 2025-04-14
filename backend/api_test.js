// api_test.js

const yahooFinance = require('yahoo-finance2').default;

let data = [];

// Function to fetch data by key
async function getDataByKey(key) {

    const symbol = key;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);  // Set start date to 30 days ago

    try {
        const historicalData = await yahooFinance.historical(symbol, {
            period1: startDate.toISOString(),
            period2: endDate.toISOString(),
            interval: '1d'  // Daily interval
        });

        // Extract the 'close' prices for the last 30 days
         data = historicalData.map(data => data.close);

        // Return the prices array
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}




module.exports = { getDataByKey };
