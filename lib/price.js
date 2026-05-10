const { log } = require('./config');

/**
 * Fetches the current TRX price from TronScan public API
 * @returns {Promise<number|null>} Price in USDT or null on error
 */
async function getTrxPrice() {
    try {
        // TronScan API now requires authorization, switching to Binance public API
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        const price = parseFloat(data.price);
        
        if (isNaN(price)) throw new Error('Invalid price format from API');
        
        return price;
    } catch (err) {
        log(`Error fetching TRX price from Binance: ${err.message}`);
        return null;
    }
}

module.exports = { getTrxPrice };
