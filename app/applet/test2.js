import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    // Add aggressive error trapping
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER_ERROR:', msg.text());
        }
    });
    
    page.on('pageerror', err => {
        console.log('PAGE_ERROR_CRASH:', err.toString());
    });
    
    try {
        await page.goto('http://localhost:3000/editor/123', { waitUntil: 'load', timeout: 5000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
        console.log('GOTO_ERROR:', e.message);
    }
    
    await browser.close();
})();
