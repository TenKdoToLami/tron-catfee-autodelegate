const { getCatfeeTarget } = require('../lib/catfee');
const { delegateEnergy } = require('../lib/actions');

(async () => {
    console.log('Testing Delegation...');
    const target = await getCatfeeTarget();
    if (target) {
        await delegateEnergy(target);
    } else {
        console.log('Could not test: No active Catfee target found.');
    }
})();
