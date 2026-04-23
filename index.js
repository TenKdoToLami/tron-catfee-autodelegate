const fs = require('fs').promises;
const { CONFIG, sleep, log } = require('./lib/config');
const { getCatfeeTarget } = require('./lib/catfee');
const { 
    claimRewards, 
    stakeEnergy, 
    voteSR, 
    delegateEnergy 
} = require('./lib/actions');

/**
 * Handles the persistent state of the automation
 */
async function getState() {
    try {
        const data = await fs.readFile(CONFIG.STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { lastAction: 'STAKE_VOTE_DELEGATE' };
    }
}

async function saveState(state) {
    try {
        await fs.writeFile(CONFIG.STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        log(`CRITICAL: Could not save state file: ${error.message}`);
    }
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
    } else {
        log('Automation cycle failed. Check logs above for details.');
        process.exit(1);
    }
}

main().catch((err) => {
    log(`UNHANDLED FATAL ERROR: ${err.message}`);
    process.exit(1);
});
