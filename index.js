const fs = require('fs').promises;
const path = require('path');
const { CONFIG, sleep, log } = require('./lib/config');
const { getCatfeeTarget } = require('./lib/catfee');
const { 
    claimRewards, 
    stakeEnergy, 
    voteSR, 
    delegateEnergy,
    getAccountSnapshot 
} = require('./lib/actions');
const { recordSnapshot } = require('./lib/history');
const { getStateValue, setStateValue } = require('./lib/db');

/**
 * Handles the persistent state of the automation
 */
async function getState() {
    // Check if we need to migrate from state.json
    try {
        const oldStatePath = path.join(__dirname, 'state.json');
        const stats = await fs.stat(oldStatePath);
        if (stats.isFile()) {
            const data = await fs.readFile(oldStatePath, 'utf8');
            const oldState = JSON.parse(data);
            log('Migrating state from state.json to database...');
            setStateValue('lastAction', oldState.lastAction);
            // Delete the old file
            await fs.unlink(oldStatePath);
        }
    } catch (e) {
        // No migration needed
    }

    return {
        lastAction: getStateValue('lastAction', 'STAKE_VOTE_DELEGATE')
    };
}

async function saveState(state) {
    setStateValue('lastAction', state.lastAction);
}

/**
 * Orchestrates the stake, vote, and delegation sequence
 */
async function runStakeRoutine() {
    log('--- STARTING STAKE/VOTE/DELEGATE ROUTINE ---');
    
    // 1. Stake new TRX
    const stakeRes = await stakeEnergy();
    if (!stakeRes.success) return false;
    
    log('Waiting 5s for network update...');
    await sleep(5000);

    // 2. Refresh Votes
    const voteRes = await voteSR();
    if (!voteRes.success) return false;

    log('Waiting 5s before delegation...');
    await sleep(5000);

    // 3. Delegate to Catfee
    const target = await getCatfeeTarget();
    if (target) {
        const delegateRes = await delegateEnergy(target);
        if (!delegateRes.success) return false;
    } else {
        log('Skipping delegation: No Catfee target found.');
    }
    
    return true;
}

async function main() {
    const state = await getState();
    const lastAction = state.lastAction;
    
    // Toggle state FIRST so that next run always alternates
    state.lastAction = (lastAction === 'STAKE_VOTE_DELEGATE') ? 'CLAIM_REWARDS' : 'STAKE_VOTE_DELEGATE';
    await saveState(state);
    
    log(`State advanced to ${state.lastAction}. Executing ${lastAction === 'STAKE_VOTE_DELEGATE' ? 'Claim' : 'Stake'} routine...`);

    if (lastAction === 'STAKE_VOTE_DELEGATE') {
        await claimRewards();
    } else {
        await runStakeRoutine();
    }
    
    log('Automation cycle finished.');
}

main().catch((err) => {
    log(`UNHANDLED FATAL ERROR: ${err.message}`);
    process.exit(1);
});
