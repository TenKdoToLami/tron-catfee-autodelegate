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

        const account = await tronWeb.trx.getAccount(address);
        let energyStakedSun = 0;
        if (account.frozenV2) {
            account.frozenV2.forEach(item => {
                if (item.type === 'ENERGY' || !item.type) {
                    energyStakedSun += item.amount;
                }
            });
        }

        let delegatedSun = account.delegated_frozen_balance_for_energy || 0;
        const availableToDelegateSun = Math.max(0, energyStakedSun - delegatedSun);

        if (availableToDelegateSun >= 1_000_000) {
            log(`Delegating ${availableToDelegateSun / 1_000_000} Energy Power to ${targetWallet}...`);
            const delegateTx = await tronWeb.transactionBuilder.delegateResource(availableToDelegateSun, 'ENERGY', targetWallet, address);
            const signedDelegateTx = await tronWeb.trx.sign(delegateTx);
            const receipt = await tronWeb.trx.sendRawTransaction(signedDelegateTx);
            
            if (receipt.result) {
                log('Delegated successfully.');
                return result(true, receipt.txid);
            }
            return result(false, null, 'Delegation transaction rejected');
        } else {
            log('No new Energy Power available to delegate.');
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
