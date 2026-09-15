const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const fs = require('fs');

// Enable stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Finds an installed system browser executable if available
 */
function findChromeExecutable() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) {
            return c;
        }
    }
    return undefined;
}

/**
 * Attempts to locate and click Cloudflare Turnstile checkbox if present.
 * @param {import('puppeteer').Page} page 
 */
async function trySolveTurnstileCheckbox(page) {
    try {
        // Look for Cloudflare challenge iframes
        for (const frame of page.frames()) {
            const frameUrl = frame.url();
            if (frameUrl.includes('cloudflare.com') || frameUrl.includes('challenge-platform') || frameUrl.includes('turnstile')) {
                // Try finding actual checkbox or clickable label within frame
                const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, span.mark, [role="checkbox"]');
                if (checkbox) {
                    await checkbox.click().catch(() => {});
                    return true;
                }
            }
        }

        // Check if iframe element itself can be clicked from the main page
        const iframeElement = await page.$('iframe[src*="cloudflare.com"], iframe[src*="challenge-platform"], iframe[src*="turnstile"]');
        if (iframeElement) {
            const box = await iframeElement.boundingBox();
            if (box) {
                // Click near the checkbox inside the iframe (typically left-center)
                await page.mouse.click(box.x + Math.min(30, box.width / 4), box.y + box.height / 2);
                return true;
            }
        }
    } catch {
        // Non-fatal, let polling continue
    }
    return false;
}

/**
 * Fetches Catfee projects using headless Chrome with Stealth plugin to solve Cloudflare Turnstile.
 * @param {string} url - Target URL (defaults to Catfee stake project API)
 * @param {number} timeoutMs - Maximum total execution time in milliseconds (default 40s)
 * @returns {Promise<Array|null>} Array of projects or null on failure
 */
async function fetchCatfeeWithPuppeteer(url = 'https://catfee.io/api/stake/public/project', timeoutMs = 40000) {
    let browser = null;
    const startTime = Date.now();

    try {
        const executablePath = findChromeExecutable();
        if (executablePath) {
            console.log(`[Puppeteer] Using system Chrome: ${executablePath}`);
        } else {
            console.log('[Puppeteer] Launching bundled browser with stealth...');
        }

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`[Puppeteer] Navigating to ${url}...`);
        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 25000
            });
        } catch (navErr) {
            console.log(`[Puppeteer] Navigation notice: ${navErr.message} (continuing to poll...)`);
        }

        console.log('[Puppeteer] Waiting for Cloudflare challenge to resolve...');
        let rawJson = null;
        let lastAttempt = 0;

        while (Date.now() - startTime < timeoutMs) {
            const pageTitle = await page.title().catch(() => '');
            
            // If the challenge resolved, page title is no longer "Just a moment..."
            if (pageTitle && !pageTitle.includes('Just a moment')) {
                const bodyText = await page.evaluate(() => {
                    const pre = document.querySelector('pre');
                    if (pre && pre.innerText) return pre.innerText;
                    return document.body ? document.body.innerText : '';
                }).catch(() => '');

                if (bodyText) {
                    const trimmed = bodyText.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (parsed && (parsed.data || Array.isArray(parsed))) {
                                rawJson = parsed.data || parsed;
                                console.log(`[Puppeteer] Successfully bypassed challenge in ${Date.now() - startTime}ms!`);
                                break;
                            }
                        } catch {
                            // JSON not fully buffered yet
                        }
                    }
                }
            } else {
                // Periodically check frames and interact with Turnstile
                const now = Date.now();
                if (now - startTime > 4000 && now - lastAttempt > 3000) {
                    lastAttempt = now;
                    const frames = page.frames();
                    const cfFrame = frames.find(f => f.url().includes('cloudflare.com') || f.url().includes('challenge-platform'));
                    
                    if (cfFrame) {
                        const clicked = await trySolveTurnstileCheckbox(page);
                        if (clicked) {
                            console.log('[Puppeteer] Clicked Turnstile checkbox inside iframe.');
                        }
                    } else {
                        // Check if an error or block message is on page
                        const errorMsg = await page.evaluate(() => {
                            const errEl = document.querySelector('#challenge-error-text, .cf-error-details');
                            return errEl ? errEl.innerText : null;
                        }).catch(() => null);
                        if (errorMsg) {
                            console.warn(`[Puppeteer] Cloudflare page notice: ${errorMsg}`);
                        }
                    }
                }
            }

            await new Promise(r => setTimeout(r, 1200));
        }

        if (!rawJson) {
            const finalTitle = await page.title().catch(() => 'unknown');
            const pageSnippet = await page.evaluate(() => {
                const el = document.querySelector('.main-content, #challenge-stage, body');
                return el ? el.innerText.slice(0, 300) : '';
            }).catch(() => '');
            console.warn(`[Puppeteer] Timed out. Title: "${finalTitle}". Content: ${pageSnippet.replace(/\n+/g, ' ')}`);
            return null;
        }

        return rawJson;
    } catch (err) {
        console.error(`[Puppeteer] Scraper error: ${err.message}`);
        return null;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
            console.log('[Puppeteer] Browser closed.');
        }
    }
}

module.exports = { fetchCatfeeWithPuppeteer };
