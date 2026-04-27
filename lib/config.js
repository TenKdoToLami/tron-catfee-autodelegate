const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { TronWeb } = require('tronweb');

// --- Configuration Constants ---
const CONFIG = {
    DATABASE_FILE: path.join(__dirname, '../data.db'),
    VOTE_SR_ADDRESS: process.env.VOTE_SR_ADDRESS || 'TTcYhypP8m4phDhN6oRexz2174zAerjEWP',
    TRX_FEE_RESERVE: process.env.TRX_FEE_RESERVE !== undefined ? parseInt(process.env.TRX_FEE_RESERVE) : 20,
    FULL_HOST: process.env.FULL_HOST || 'https://api.trongrid.io',
    SECONDARY_HOST: process.env.SECONDARY_HOST || 'https://api.tronstack.io',
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    TRONGRID_API_KEY: process.env.TRONGRID_API_KEY
};

// --- Validation ---
if (!CONFIG.PRIVATE_KEY) {
    console.error('CRITICAL ERROR: PRIVATE_KEY is not defined in .env file.');
    process.exit(1);
}

// --- Initialize TronWeb Instances ---
const tronWeb = new TronWeb({
    fullHost: CONFIG.FULL_HOST,
    privateKey: CONFIG.PRIVATE_KEY,
    headers: CONFIG.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': CONFIG.TRONGRID_API_KEY } : {}
});

const secondaryTronWeb = new TronWeb({
    fullHost: CONFIG.SECONDARY_HOST,
    privateKey: CONFIG.PRIVATE_KEY
});

// --- Utility Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

module.exports = {
    tronWeb,
    secondaryTronWeb,
    CONFIG,
    sleep,
    log
};
