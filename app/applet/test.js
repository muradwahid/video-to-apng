import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
        
        await page.goto('http://localhost:3000/editor/123', { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 4000));
        
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
