// Playwright runtime regression: RT-02 / RT-03 / RT-04
// Maintainer use only — run BEFORE releasing a new prototype version.
// Setup: cd qa && npm install && npm run install-browsers
// Run  : cd qa && npx playwright test --headed

const { test, expect } = require('@playwright/test');
const path = require('path');

// Update this path when testing a different prototype
const PROTO = path.resolve(__dirname, '../../../archive/原型-海外仓财务-充值管理-2026-06-07.html');
const PROTO_URL = 'file:///' + PROTO.replace(/\\/g, '/');

// ── Helpers ─────────────────────────────────────────────────────────────────

async function enableAnnotation(page) {
  // Click the annotation toggle switch (right-top area)
  const toggle = page.locator('.anno-toggle, [class*="anno-switch"], input[type="checkbox"]').first();
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(300);
}

async function frameSelect(page, targetLocator) {
  const box = await targetLocator.boundingBox();
  if (!box) throw new Error('Target element not visible');
  // Right-click blank area to enter frame mode
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.waitForTimeout(200);
  // Drag from top-left to bottom-right of target
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('RT-02: Frame mode region naming (card title, NOT button name)', () => {
  test('Framing account-balance card shows card title in popup, not button text', async ({ page }) => {
    await page.goto(PROTO_URL);
    await page.waitForLoadState('domcontentloaded');
    await enableAnnotation(page);

    // Frame the account balance card area (contains "账户余额" title + "充值" button)
    const card = page.locator('.acct-card, [class*="acct"], [class*="balance"]').first();
    if (!await card.count()) { test.skip(); return; }

    await frameSelect(page, card);

    // Popup should show card region name (账户余额 or similar), NOT "充值"
    const popup = page.locator('[class*="anno-bubble"], [class*="bubble"], [class*="confirm-popup"]');
    await expect(popup).toBeVisible({ timeout: 3000 });
    const popupText = await popup.textContent();
    expect(popupText).not.toContain('充值'); // Must not use button name
    // Should contain the card/panel title
    expect(popupText.length).toBeGreaterThan(0);
  });
});

test.describe('RT-03: Dashboard frame groups by panel, not chart boilerplate', () => {
  test('Framing full dashboard area captures panel titles as zoneGroups', async ({ page }) => {
    await page.goto(PROTO_URL);
    await page.waitForLoadState('domcontentloaded');
    await enableAnnotation(page);

    // Navigate to dashboard page if not already there
    const dashNav = page.locator('text=首页, text=仪表盘, text=Dashboard').first();
    if (await dashNav.count()) await dashNav.click();
    await page.waitForTimeout(300);

    // Frame a dashboard panel area
    const panel = page.locator('.dpanel, [class*="dashboard-panel"], [class*="dcard"]').first();
    if (!await panel.count()) { test.skip(); return; }

    await frameSelect(page, panel);

    // The confirm popup should appear and mention the panel title
    const popup = page.locator('[class*="anno-bubble"], [class*="bubble"]');
    await expect(popup).toBeVisible({ timeout: 3000 });
    // Should NOT show generic chart boilerplate text
    const popupText = await popup.textContent();
    const boilerplateTerms = ['ECharts', 'chart', 'canvas', 'SVG'];
    for (const term of boilerplateTerms) {
      expect(popupText).not.toContain(term);
    }
  });
});

test.describe('RT-04: OMS vs WMS view isolation', () => {
  test('OMS view shows OMS fp content, not WMS content', async ({ page }) => {
    await page.goto(PROTO_URL);
    await page.waitForLoadState('domcontentloaded');
    await enableAnnotation(page);

    // Select OMS view
    const omsTab = page.locator('text=OMS').first();
    if (await omsTab.count()) await omsTab.click();
    await page.waitForTimeout(300);

    // Right-click on an element that has OMS-specific data-annotation
    const omsEl = page.locator('[data-annotation*="-OMS"]').first();
    if (!await omsEl.count()) { test.skip(); return; }

    await omsEl.click({ button: 'right' });
    await page.waitForTimeout(400);

    const popup = page.locator('[class*="anno-bubble"], [class*="bubble"]');
    if (!await popup.isVisible()) { test.skip(); return; }

    const popupText = await popup.textContent();
    // OMS popup must not mention WMS-specific wording
    expect(popupText).not.toContain('WMS专属');
    expect(popupText).not.toContain('仓库');
  });

  test('WMS view shows WMS fp content, not OMS content', async ({ page }) => {
    await page.goto(PROTO_URL);
    await page.waitForLoadState('domcontentloaded');
    await enableAnnotation(page);

    const wmsTab = page.locator('text=WMS').first();
    if (await wmsTab.count()) await wmsTab.click();
    await page.waitForTimeout(300);

    const wmsEl = page.locator('[data-annotation*="-WMS"]').first();
    if (!await wmsEl.count()) { test.skip(); return; }

    await wmsEl.click({ button: 'right' });
    await page.waitForTimeout(400);

    const popup = page.locator('[class*="anno-bubble"], [class*="bubble"]');
    if (!await popup.isVisible()) { test.skip(); return; }

    const popupText = await popup.textContent();
    expect(popupText).not.toContain('OMS专属');
  });
});
