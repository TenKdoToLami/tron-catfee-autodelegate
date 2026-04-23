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
        // Check if we need to migrate from history.json
        try {
            const stats = await fs.stat(HISTORY_FILE);
            if (stats.isFile()) {
                log('Migrating history from history.json to database...');
                const existingData = await fs.readFile(HISTORY_FILE, 'utf8');
                const history = JSON.parse(existingData);
                for (const entry of history) {
                    addHistoryEntry(entry);
                }
                // Delete the old file
                await fs.unlink(HISTORY_FILE);
            }
        } catch (e) {
            // No migration needed or file doesn't exist
        }

        addHistoryEntry(data);
        log(`Snapshot recorded in database: Total ${data.totalTrx.toFixed(2)} TRX`);
    } catch (error) {
        log(`Error recording snapshot: ${error.message}`);
    }
}

module.exports = { recordSnapshot };
