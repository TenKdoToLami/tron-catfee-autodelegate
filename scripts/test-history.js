const { getAccountSnapshot } = require('../lib/actions');
const { recordSnapshot } = require('../lib/history');

(async () => {
    console.log('Testing History Snapshot...');
    const snapshot = await getAccountSnapshot();
    if (snapshot) {
        await recordSnapshot({
            action: 'MANUAL_TEST',
            ...snapshot
        });
        console.log('Test snapshot recorded successfully. Check the SQL database.');
    } else {
        console.log('Failed to fetch snapshot.');
    }
})();
