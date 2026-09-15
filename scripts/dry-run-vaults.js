const { getCatfeeTarget } = require('../lib/catfee');

(async () => {
    console.log('=== CATFEE VAULT CHECK (DRY RUN) ===');
    const startTime = Date.now();
    
    try {
        const target = await getCatfeeTarget();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('\n--- Result ---');
        if (target) {
            console.log(`✅ Selected Target Receiver: ${target}`);
            console.log(`⏱️ Completed in ${duration}s`);
        } else {
            console.log('❌ No active Catfee vault found or available.');
            console.log(`⏱️ Completed in ${duration}s`);
        }
    } catch (err) {
        console.error('Fatal error during vault check:', err.message);
    }
})();
