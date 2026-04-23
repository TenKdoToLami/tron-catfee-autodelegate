const Database = require('better-sqlite3');
const { CONFIG, log } = require('./config');

const db = new Database(CONFIG.DATABASE_FILE);

// Initialize database schema
db.exec(`
    CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        date TEXT,
        action TEXT,
        staked REAL,
        unstaked REAL,
        totalTrx REAL
    );
`);

/**
 * Gets a value from the state table
 */
function getStateValue(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM state WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : defaultValue;
}

/**
 * Sets a value in the state table
 */
function setStateValue(key, value) {
    const stmt = db.prepare('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)');
    stmt.run(key, JSON.stringify(value));
}

/**
 * Records a snapshot into history
 */
function addHistoryEntry(data) {
    const stmt = db.prepare(`
        INSERT INTO history (date, action, staked, unstaked, totalTrx)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    const date = data.date || new Date().toISOString().split('T')[0];
    stmt.run(
        date,
        data.action,
        data.staked,
        data.unstaked,
        data.totalTrx
    );
}

module.exports = {
    getStateValue,
    setStateValue,
    addHistoryEntry,
    db
};
