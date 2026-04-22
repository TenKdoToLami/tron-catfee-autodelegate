require('dotenv').config();
const { TronWeb } = require('tronweb');
const fs = require('fs').promises;
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');
const VOTE_SR_ADDRESS = process.env.VOTE_SR_ADDRESS || 'TTcYhypP8m4phDhN6oRexz2174zAerjEWP';
const TRX_FEE_RESERVE = parseInt(process.env.TRX_FEE_RESERVE) || 20;

const tronWeb = new TronWeb({
    fullHost: process.env.FULL_HOST || 'https://api.trongrid.io',
    privateKey: process.env.PRIVATE_KEY
});

async function getState() {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { lastAction: 'STAKE_VOTE_DELEGATE' }; // Default to start with claiming next
    }
}

async function saveState(state) {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function getCatfeeTarget() {
    console.log('Fetching active energy vaults from Catfee.io...');
    try {
        const response = await fetch('https://catfee.io/api/stake/public/project');
        if (!response.ok) throw new Error('Catfee API responded with error');
        
        const data = await response.json();
        // data.data is an array of projects
        const energyVaults = data.data.filter(p => 
            p.resource_type === 'ENERGY' && 
            p.status === 'NORMAL' &&
            p.receiver &&
            !(p.name_en || '').toLowerCase().includes('whale')
        );

        if (energyVaults.length > 0) {
            // Sort by apy descending to get the best one
            energyVaults.sort((a, b) => b.apy - a.apy);
            const bestVault = energyVaults[0];
            console.log(`Found active Catfee vault: ${bestVault.name_en || 'Unknown'} (${bestVault.receiver}) - APY: ${bestVault.apy}%`);
            return bestVault.receiver;
        } else {
            console.log('No active energy vaults found on Catfee.io.');
        }
    } catch (error) {
        console.error('Error fetching Catfee vaults:', error.message);
    }
    return null;
}

async function claimRewards() {
    console.log('--- Action 1: Claiming Staking Rewards ---');
    try {
        const address = tronWeb.defaultAddress.base58;
        // In TronWeb 6+, withdrawReward is usually withdrawBlockRewards
        const transaction = await tronWeb.transactionBuilder.withdrawBlockRewards(address);
        const signedTx = await tronWeb.trx.sign(transaction);
        const receipt = await tronWeb.trx.sendRawTransaction(signedTx);
        console.log('Claim result:', receipt.result ? 'Success' : 'Failed', receipt.txid || '');
        return receipt.result;
    } catch (error) {
        console.error('Error claiming rewards:', error.message);
        return false;
    }
}

async function stakeVoteDelegate() {
    console.log('--- Action 2: Stake, Vote, and Delegate ---');
    try {
        const address = tronWeb.defaultAddress.base58;
        if (!address) {
            throw new Error('Wallet address not found. Please ensure PRIVATE_KEY is set in .env');
        }

        // Pre-fetch Catfee target for visibility
        let dynamicTarget = await getCatfeeTarget();

        // 1. Get Balance
        const balanceSun = await tronWeb.trx.getBalance(address);
        const balanceTrx = balanceSun / 1_000_000;
        console.log(`Current Balance: ${balanceTrx.toFixed(2)} TRX`);

        // Leave TRX_FEE_RESERVE for gas/fees
        const amountToStakeTrx = Math.max(0, balanceTrx - TRX_FEE_RESERVE);
        const amountToStakeSun = Math.floor(amountToStakeTrx * 1_000_000);

        if (amountToStakeSun >= 1_000_000) { // Minimum 1 TRX
            console.log(`Staking ${amountToStakeTrx.toFixed(2)} TRX for Energy...`);
            const stakeTx = await tronWeb.transactionBuilder.freezeBalanceV2(amountToStakeSun, 'ENERGY', address);
            const signedStakeTx = await tronWeb.trx.sign(stakeTx);
            await tronWeb.trx.sendRawTransaction(signedStakeTx);
            console.log('Staked successfully.');
        } else {
            console.log('Insufficient balance to stake (leaving 20 TRX for fees).');
        }

        // 2. Vote for Cryptoguyinza
        const account = await tronWeb.trx.getAccount(address);

        // Calculate TRON Power (Total Staked TRX)
        let totalStakedSun = 0;
        if (account.frozenV2) {
            account.frozenV2.forEach(item => {
                if (item.amount) totalStakedSun += item.amount;
            });
        }
        // Legacy Stake V1
        if (account.frozen) {
            account.frozen.forEach(item => {
                if (item.frozen_balance) totalStakedSun += item.frozen_balance;
            });
        }

        const voteAmount = Math.floor(totalStakedSun / 1_000_000);
        if (voteAmount > 0) {
            console.log(`Voting ${voteAmount} for SR: ${VOTE_SR_ADDRESS}...`);
            // In TronWeb 6+, voteWitness might be just 'vote' or 'voteWitness'
            const voteMethod = tronWeb.transactionBuilder.vote || tronWeb.transactionBuilder.voteWitness;
            // Format: { [address]: count } for old API, or array for new? 
            // Let's try the object format first as it's common in TronWeb.
            const voteTx = await voteMethod({ [VOTE_SR_ADDRESS]: voteAmount }, address);
            const signedVoteTx = await tronWeb.trx.sign(voteTx);
            await tronWeb.trx.sendRawTransaction(signedVoteTx);
            console.log('Voted successfully.');
        }

        // 3. Delegate Energy
        // Use pre-fetched dynamicTarget (No fallback to .env as requested)
        let targetWallet = dynamicTarget;

        if (!targetWallet) {
            console.log('No active energy vaults found on Catfee.io (excluding whales). Skipping delegation.');
            return true;
        }

        // Get total energy power and currently delegated
        const resources = await tronWeb.trx.getAccountResources(address);

        let energyStakedSun = 0;
        if (account.frozenV2) {
            account.frozenV2.forEach(item => {
                if (item.type === 'ENERGY' || !item.type) {
                    energyStakedSun += item.amount;
                }
            });
        }

        // Subtract what is already delegated
        let delegatedSun = account.delegated_frozen_balance_for_energy || 0;
        const availableToDelegateSun = Math.max(0, energyStakedSun - delegatedSun);

        if (availableToDelegateSun >= 1_000_000) {
            console.log(`Delegating ${availableToDelegateSun / 1_000_000} Energy Power to ${targetWallet}...`);
            const delegateTx = await tronWeb.transactionBuilder.delegateResource(availableToDelegateSun, 'ENERGY', targetWallet, address);
            const signedDelegateTx = await tronWeb.trx.sign(delegateTx);
            await tronWeb.trx.sendRawTransaction(signedDelegateTx);
            console.log('Delegated successfully.');
        } else {
            console.log('No new Energy Power available to delegate.');
        }

        return true;
    } catch (error) {
        console.error('Error in stake/vote/delegate:', error.message);
        return false;
    }
}

async function main() {
    const state = await getState();
    console.log(`Last action performed: ${state.lastAction}`);

    let success = false;
    if (state.lastAction === 'STAKE_VOTE_DELEGATE') {
        // Last time we staked, so now we claim
        success = await claimRewards();
        if (success) {
            state.lastAction = 'CLAIM_REWARDS';
        }
    } else {
        // Last time we claimed, so now we stake/vote/delegate
        success = await stakeVoteDelegate();
        if (success) {
            state.lastAction = 'STAKE_VOTE_DELEGATE';
        }
    }

    if (success) {
        await saveState(state);
        console.log(`State updated. Next action will be: ${state.lastAction === 'CLAIM_REWARDS' ? 'STAKE_VOTE_DELEGATE' : 'CLAIM_REWARDS'}`);
    } else {
        console.log('Operation failed. State not updated.');
    }
}

main().catch(console.error);
