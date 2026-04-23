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
    log(`Current State: Last action was ${state.lastAction}`);

    let success = false;
    if (state.lastAction === 'STAKE_VOTE_DELEGATE') {
        const res = await claimRewards();
        if (res.success) {
            state.lastAction = 'CLAIM_REWARDS';
            success = true;
        }
    } else {
        success = await runStakeRoutine();
        if (success) {
            state.lastAction = 'STAKE_VOTE_DELEGATE';
        }
    }

    if (success) {
        await saveState(state);
        log(`Automation completed. Next expected action: ${state.lastAction === 'CLAIM_REWARDS' ? 'STAKE_VOTE_DELEGATE' : 'CLAIM_REWARDS'}`);
        
        // Record Daily History Snapshot
        const snapshot = await getAccountSnapshot();
        if (snapshot) {
            await recordSnapshot({
                action: state.lastAction, // This is the action just completed
                ...snapshot
            });
        }
    } else {
        log('Automation cycle failed. Check logs above for details.');
        process.exit(1);
    }
}

main().catch((err) => {
    log(`UNHANDLED FATAL ERROR: ${err.message}`);
    process.exit(1);
});
