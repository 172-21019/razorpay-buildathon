const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  // Open AI Agent
  await page.click('.ai-trigger-btn');
  await page.waitForTimeout(500);
  
  // Search sunglasses under 200
  await page.type('.ai-capsule input', 'sunglasses under 200');
  await page.click('.send-btn');
  
  // Wait for result
  await page.waitForFunction(() => document.querySelector('.ai-status-message') && document.querySelector('.ai-status-message').innerText.includes('over your budget'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot1.png' });
  console.log('Saved screenshot1.png');
  
  // Search shoes
  await page.click('.ai-capsule input');
  await page.type('.ai-capsule input', 'shoes');
  await page.click('.send-btn');
  
  // Wait for result
  await page.waitForFunction(() => document.querySelector('.ai-status-message') && document.querySelector('.ai-status-message').innerText.includes('Here is the top pick'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot2.png' });
  console.log('Saved screenshot2.png');
  
  await browser.close();
})();
