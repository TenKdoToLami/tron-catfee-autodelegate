const { voteSR } = require('../lib/actions');

(async () => {
    console.log('Testing Vote for SR...');
    await voteSR();
})();
