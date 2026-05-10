const fs = require('fs').promises;
const path = require('path');
const { log } = require('./config');
const { addHistoryEntry } = require('./db');

const HISTORY_FILE = path.join(__dirname, '../history.json');

/**
 * Records a daily snapshot into the SQL database
 */
async function recordSnapshot(data) {
    try {

        addHistoryEntry(data);
        const priceStr = data.trxPrice ? ` (@ $${data.trxPrice.toFixed(4)})` : '';
        log(`Snapshot recorded in database: Total ${data.totalTrx.toFixed(2)} TRX${priceStr}`);
    } catch (error) {
        log(`Error recording snapshot: ${error.message}`);
    }
}

module.exports = { recordSnapshot };
