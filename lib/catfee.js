const { fetchCatfeeWithPuppeteer } = require('./scraper');

/**
 * Fetches active energy vaults from Catfee.io.
 * Tries standard fetch first; falls back to Puppeteer stealth on Cloudflare 403 / challenge.
 * If no active vault is discovered, returns null (no fallback delegation).
 */
async function getCatfeeTarget() {
    console.log('Fetching active energy vaults from Catfee.io...');
    let projects = null;

    // 1. Attempt fast native fetch
    try {
        const response = await fetch('https://catfee.io/api/stake/public/project');
        if (response.ok) {
            const data = await response.json();
            projects = data.data || data;
        } else {
            console.log(`Catfee API returned HTTP ${response.status} (${response.statusText || 'Error'}).`);
            if (response.status === 403) {
                console.log('Cloudflare protection detected. Initiating Puppeteer stealth scraper...');
            }
        }
    } catch (error) {
        console.warn('Native fetch failed:', error.message);
    }

    // 2. If native fetch failed or was blocked by Cloudflare, use Puppeteer stealth
    if (!projects || !Array.isArray(projects)) {
        try {
            console.log('Fetching Catfee projects via Puppeteer stealth...');
            projects = await fetchCatfeeWithPuppeteer();
        } catch (pupError) {
            console.error('Puppeteer scraper encountered an error:', pupError.message);
        }
    }

    // 3. Process projects if retrieved
    if (projects && Array.isArray(projects)) {
        const energyVaults = projects.filter(p => 
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
            console.log('No active energy vaults matching criteria found in Catfee response.');
        }
    }

    console.log('No Catfee target found. Delegation will be skipped.');
    return null;
}

module.exports = { getCatfeeTarget };



