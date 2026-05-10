const { getAccountSnapshot } = require('../lib/actions');
const { recordSnapshot } = require('../lib/history');
const { getTrxPrice } = require('../lib/price');

(async () => {
    console.log('Testing History Snapshot...');
    const snapshot = await getAccountSnapshot();
    const trxPrice = await getTrxPrice();
    
    if (snapshot) {
        await recordSnapshot({
            action: 'MANUAL_TEST',
            ...snapshot,
            trxPrice,
            txids: ['test_tx_1', 'test_tx_2']
        });
        console.log('Test snapshot recorded successfully. Check the SQL database.');
    } else {
        console.log('Failed to fetch snapshot.');
    }
})();
