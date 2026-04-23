const { claimRewards } = require('../lib/actions');

(async () => {
    console.log('Testing Claim Rewards...');
    await claimRewards();
})();
