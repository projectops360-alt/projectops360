import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3001/navigator-preview", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Shot 1: header with the Navigator button (closed state)
await page.screenshot({ path: "scripts/_nav_shot1_closed.png" });

// Click the Navigator button (compass icon button) and wait for the drawer
await page.getByRole("button", { name: /Open Navigator guided help|Navigator/ }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "scripts/_nav_shot2_open.png", fullPage: false });

// Spanish variant: force locale es via the provider is fixed to en here; skip.
await browser.close();
console.log("OK screenshots saved");