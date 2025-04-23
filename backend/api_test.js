// api_test.js

const yahooFinance = require('yahoo-finance2').default;

// Function to fetch data by key
async function getDataByKey(key) {
  const symbol = key;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 14); // 14 days ago

  try {
    const historicalData = await yahooFinance.historical(symbol, {
      period1: startDate.toISOString(),
      period2: endDate.toISOString(),
      interval: '1d'
    });

    const data = historicalData.map(entry => entry.close);
    return data;

  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
}

module.exports = { getDataByKey };
