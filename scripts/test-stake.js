const { stakeEnergy } = require('../lib/actions');

(async () => {
    console.log('Testing Stake Energy...');
    await stakeEnergy();
})();
