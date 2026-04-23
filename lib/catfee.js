async function getCatfeeTarget() {
    console.log('Fetching active energy vaults from Catfee.io...');
    try {
        const response = await fetch('https://catfee.io/api/stake/public/project');
        if (!response.ok) throw new Error('Catfee API responded with error');
        
        const data = await response.json();
        const energyVaults = data.data.filter(p => 
            p.resource_type === 'ENERGY' && 
            p.status === 'NORMAL' &&
            p.receiver &&
            !(p.name_en || '').toLowerCase().includes('whale')
        );

        if (energyVaults.length > 0) {
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

module.exports = { getCatfeeTarget };
