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
const { getTrxPrice } = require('./lib/price');

/**
 * Handles the persistent state of the automation
 */
async function getState() {
    return {
        lastAction: getStateValue('lastAction', 'CLAIM_REWARDS')
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
    const results = { stake: null, vote: null, delegate: null };
    
    // 1. Stake new TRX
    const stakeRes = await stakeEnergy();
    results.stake = stakeRes;
    if (!stakeRes.success) return results;
    
    log('Waiting 5s for network update...');
    await sleep(5000);

    // 2. Refresh Votes
    const voteRes = await voteSR();
    results.vote = voteRes;
    if (!voteRes.success) return results;

    log('Waiting 5 minutes for network to reflect staking power before delegation...');
    await sleep(300000); // 5 minutes

    // 3. Delegate to Catfee
    const target = await getCatfeeTarget();
    if (target) {
        const delegateRes = await delegateEnergy(target);
        results.delegate = delegateRes;
    } else {
        log('Skipping delegation: No Catfee target found.');
    }
    
    return results;
}

async function main() {
    const state = await getState();
    const lastAction = state.lastAction;
    
    // Toggle state FIRST so that next run always alternates
    state.lastAction = (lastAction === 'STAKE_VOTE_DELEGATE') ? 'CLAIM_REWARDS' : 'STAKE_VOTE_DELEGATE';
    await saveState(state);
    
    log(`State advanced to ${state.lastAction}. Executing ${lastAction === 'STAKE_VOTE_DELEGATE' ? 'Claim' : 'Stake'} routine...`);

    let routineResult;
    if (lastAction === 'STAKE_VOTE_DELEGATE') {
        routineResult = await claimRewards();
    } else {
        routineResult = await runStakeRoutine();
    }
    
    // Collect TXIDs
    const txids = [];
    if (lastAction === 'STAKE_VOTE_DELEGATE') {
        if (routineResult.txid) txids.push(routineResult.txid);
    } else {
        if (routineResult.stake?.txid) txids.push(routineResult.stake.txid);
        if (routineResult.vote?.txid) txids.push(routineResult.vote.txid);
        if (routineResult.delegate?.txid) txids.push(routineResult.delegate.txid);
    }

    // Record snapshot for history
    log('Recording account snapshot...');
    const snapshot = await getAccountSnapshot();
    const trxPrice = await getTrxPrice();

    if (snapshot) {
        await recordSnapshot({
            ...snapshot,
            action: lastAction === 'STAKE_VOTE_DELEGATE' ? 'CLAIM' : 'STAKE',
            trxPrice,
            txids
        });
    }
    
    log('Automation cycle finished.');
}

main().catch((err) => {
    log(`UNHANDLED FATAL ERROR: ${err.message}`);
    process.exit(1);
});
