import { startPreview } from './browser-support.mjs';
const { chromium } = await import(process.argv[2] ?? 'playwright');
const preview = await startPreview();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(preview.url);
  await page.getByRole('button', { name: 'Preview resting style' }).click();
  const art = await page.locator('.companion-art').first().evaluate(el => el.outerHTML);
  const icon = new URL('favicon.svg', preview.url).href;
  await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#f8f7f2;color:#2d302c;font-family:Arial,sans-serif}.social{width:1200px;height:630px;display:grid;grid-template-columns:1.1fr 1fr;padding:60px;gap:60px;align-items:center}.brand{display:flex;gap:13px;align-items:center;font-size:24px}.brand img{width:44px;height:44px}h1{font-size:57px;line-height:1.12;letter-spacing:-2px;margin:44px 0 25px}h1 span{color:#594787}p{font-size:22px;line-height:1.5;max-width:420px;color:#626159}.tag{font-size:17px;margin-top:38px;color:#594787}.art{background:#eee9f3;border-radius:30px;padding:20px 0}.art svg{width:100%;height:auto}</style></head><body><div class="social"><div><div class="brand"><img src="${icon}"/>Squeek Companion</div><h1>A tiny companion.<br/><span>Always in sync.</span></h1><p>A living NFT following the real Squeekchain hamster.</p><div class="tag">Free mint · One per wallet · Sepolia</div></div><div class="art">${art}</div></div></body></html>`);
  await page.screenshot({ path: 'public/social.png' });
  console.log('Created public/social.png (1200 × 630) from the implemented companion illustration.');
} finally { await browser.close(); await preview.close(); }
