const { tronWeb, CONFIG, log } = require('./config');

/**
 * Standardizes the response from actions
 */
const result = (success, txid = null, message = '') => ({ success, txid, message });

async function claimRewards() {
    log('Action: Claiming Staking Rewards...');
    try {
        const address = tronWeb.defaultAddress.base58;
        const transaction = await tronWeb.transactionBuilder.withdrawBlockRewards(address);
        const signedTx = await tronWeb.trx.sign(transaction);
        const receipt = await tronWeb.trx.sendRawTransaction(signedTx);
        
        if (receipt.result) {
            log(`Claim Success! TXID: ${receipt.txid}`);
            return result(true, receipt.txid);
        } else {
            const errorMsg = receipt.message ? Buffer.from(receipt.message, 'hex').toString() : 'Unknown error';
            log(`Claim Failed: ${errorMsg}`);
            return result(false, null, errorMsg);
        }
    } catch (error) {
        log(`Error claiming rewards: ${error.message}`);
        return result(false, null, error.message);
    }
}

async function stakeEnergy() {
    log('Action: Staking TRX for Energy...');
    try {
        const address = tronWeb.defaultAddress.base58;
        const balanceSun = await tronWeb.trx.getBalance(address);
        const balanceTrx = balanceSun / 1_000_000;
        log(`Current Balance: ${balanceTrx.toFixed(2)} TRX`);

        const amountToStakeTrx = Math.max(0, balanceTrx - CONFIG.TRX_FEE_RESERVE);
        const amountToStakeSun = Math.floor(amountToStakeTrx * 1_000_000);

        if (amountToStakeSun >= 1_000_000) {
            log(`Staking ${amountToStakeTrx.toFixed(2)} TRX for Energy...`);
            const stakeTx = await tronWeb.transactionBuilder.freezeBalanceV2(amountToStakeSun, 'ENERGY', address);
            const signedStakeTx = await tronWeb.trx.sign(stakeTx);
            const receipt = await tronWeb.trx.sendRawTransaction(signedStakeTx);
            
            if (receipt.result) {
                log('Staked successfully.');
                return result(true, receipt.txid);
            }
            return result(false, null, 'Stake transaction rejected');
        } else {
            const msg = `Insufficient balance to stake (Min 1 TRX, Reserve: ${CONFIG.TRX_FEE_RESERVE} TRX).`;
            log(msg);
            return result(true, null, msg); // Success because it's a valid state, just nothing to do
        }
    } catch (error) {
        log(`Error staking: ${error.message}`);
        return result(false, null, error.message);
    }
}

async function voteSR() {
    log('Action: Voting for Super Representative...');
    try {
        const address = tronWeb.defaultAddress.base58;
        const resources = await tronWeb.trx.getAccountResources(address);
        const voteAmount = resources.tronPowerLimit || resources.TronPowerLimit || 0;

        if (voteAmount > 0) {
            log(`Voting total power (${voteAmount}) for SR: ${CONFIG.VOTE_SR_ADDRESS}...`);
            const voteTx = await (tronWeb.transactionBuilder.vote ? 
                tronWeb.transactionBuilder.vote({ [CONFIG.VOTE_SR_ADDRESS]: voteAmount }, address) : 
                tronWeb.transactionBuilder.voteWitness({ [CONFIG.VOTE_SR_ADDRESS]: voteAmount }, address));
            const signedVoteTx = await tronWeb.trx.sign(voteTx);
            const receipt = await tronWeb.trx.sendRawTransaction(signedVoteTx);
            
            if (receipt.result) {
                log('Voted successfully.');
                return result(true, receipt.txid);
            }
            return result(false, null, 'Vote transaction rejected');
        } else {
            log('No voting power (Tron Power) found.');
            return result(false, null, 'No voting power');
        }
    } catch (error) {
        log(`Error voting: ${error.message}`);
        return result(false, null, error.message);
    }
}

async function delegateEnergy(targetWallet) {
    log('Action: Delegating Energy...');
    try {
        const address = tronWeb.defaultAddress.base58;
        if (!targetWallet) {
            log('No target wallet provided for delegation.');
            return result(false);
        }

        log('Fetching account details...');
        // Fetch account, resources and can-delegate max size in parallel for efficiency
        const [account, resources, canDelegateRes] = await Promise.all([
            tronWeb.trx.getAccount(address),
            tronWeb.trx.getAccountResources(address),
            tronWeb.trx.getCanDelegatedMaxSize(address, 1).catch(() => ({ max_size: 0 }))
        ]);
        
        log('Account details fetched successfully.');
        
        // Calculate V2 staked energy manually as fallback/verification
        let energyStakedV2Sun = 0;
        if (account.frozenV2) {
            account.frozenV2.forEach(item => {
                if (item.type === 'ENERGY') {
                    energyStakedV2Sun += (item.amount || 0);
                }
            });
        }

        // Detect Stake 1.0 balance (cannot be delegated via delegateResource)
        const energyStakedV1Sun = account.account_resource?.frozen_balance_for_energy?.frozen_balance || 0;
        
        // Current delegation from V2
        const delegatedV2Sun = account.delegated_frozenV2_balance_for_energy || 0;
        
        // Use the official "can delegate" size if possible, otherwise fallback to our manual calculation
        let availableToDelegateSun = canDelegateRes.max_size || 0;
        
        // Fallback: If canDelegateRes failed or returned 0, but we see V2 stake that isn't delegated
        if (availableToDelegateSun === 0 && energyStakedV2Sun > delegatedV2Sun) {
            availableToDelegateSun = energyStakedV2Sun - delegatedV2Sun;
        }

        log(`Status - V2 Staked: ${energyStakedV2Sun / 1e6} TRX, V1 Staked: ${energyStakedV1Sun / 1e6} TRX, Delegated: ${delegatedV2Sun / 1e6} TRX`);
        log(`Available to delegate from V2: ${availableToDelegateSun / 1e6} TRX`);

        if (energyStakedV1Sun > 0) {
            log(`TIP: You have ${energyStakedV1Sun / 1e6} TRX in legacy Stake 1.0. These cannot be delegated. Consider unfreezing and re-staking in V2 to increase delegation rewards.`);
        }

        if (availableToDelegateSun >= 1_000_000) {
            log(`Delegating ${availableToDelegateSun / 1_000_000} Energy Power to ${targetWallet}...`);
            const delegateTx = await tronWeb.transactionBuilder.delegateResource(availableToDelegateSun, targetWallet, 'ENERGY', address);
            log('Transaction built. Signing...');
            const signedDelegateTx = await tronWeb.trx.sign(delegateTx);
            log('Transaction signed. Sending...');
            
            // Retry logic for sending transaction (handles 429 Too Many Requests)
            let receipt = null;
            let attempts = 3;
            while (attempts > 0) {
                try {
                    receipt = await tronWeb.trx.sendRawTransaction(signedDelegateTx);
                    break;
                } catch (sendError) {
                    if (sendError.message?.includes('429') && attempts > 1) {
                        log('Rate limited (429). Retrying in 2s...');
                        await sleep(2000);
                        attempts--;
                    } else {
                        throw sendError;
                    }
                }
            }
            
            if (receipt && receipt.result) {
                log('Delegated successfully.');
                return result(true, receipt.txid);
            }
            return result(false, null, 'Delegation transaction rejected');
        } else {
            log('No new Energy Power available to delegate from Stake 2.0.');
            return result(true, null, 'Already fully delegated');
        }
    } catch (error) {
        log(`Error delegating: ${error.message}`);
        return result(false, null, error.message);
    }
}

async function getAccountSnapshot() {
    try {
        const address = tronWeb.defaultAddress.base58;
        const balanceSun = await tronWeb.trx.getBalance(address);
        const resources = await tronWeb.trx.getAccountResources(address);
        
        const staked = resources.tronPowerLimit || resources.TronPowerLimit || 0;
        const unstaked = balanceSun / 1_000_000;
        
        return {
            staked: staked,
            unstaked: unstaked,
            totalTrx: staked + unstaked
        };
    } catch (error) {
        log(`Error fetching snapshot: ${error.message}`);
        return null;
    }
}

module.exports = {
    claimRewards,
    stakeEnergy,
    voteSR,
    delegateEnergy,
    getAccountSnapshot
};
