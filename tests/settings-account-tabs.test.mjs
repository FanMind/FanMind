import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tabsSource = await readFile("src/app/settings/AccountTabs.tsx", "utf8");
const accountSectionsSource = await readFile("src/app/settings/AccountSections.tsx", "utf8");
const profilePageSource = await readFile("src/app/settings/profile/page.tsx", "utf8");
const packagePageSource = await readFile("src/app/settings/package/page.tsx", "utf8");
const invoicesPageSource = await readFile("src/app/settings/invoices/page.tsx", "utf8");
const aiUsagePageSource = await readFile("src/app/settings/ai-usage/page.tsx", "utf8");
const referralPageSource = await readFile("src/app/settings/referral/page.tsx", "utf8");

const expectedTabs = [
  ["profile", "/settings/profile", "Profil", "Profil & Workspace"],
  ["package", "/settings/package", "Paket", "Status & Optionen"],
  ["invoices", "/settings/invoices", "Rechnungen", "Archiv & PDF"],
  ["aiUsage", "/settings/ai-usage", "KI-Nutzung", "Aktionen & Schätzwerte"],
  ["referral", "/settings/referral", "Empfehlungen", "Link & Rabatt"],
];

test("settings account tabs are defined once in the complete canonical order", () => {
  const positions = expectedTabs.map(([key, href, label, meta]) => {
    const position = tabsSource.indexOf(`key: "${key}"`);
    assert.notEqual(position, -1, `missing tab key ${key}`);
    assert.match(tabsSource, new RegExp(`key: "${key}"[\\s\\S]*?href: "${href}"`));
    assert.match(tabsSource, new RegExp(`key: "${key}"[\\s\\S]*?label: "${label}"`));
    assert.match(tabsSource, new RegExp(`key: "${key}"[\\s\\S]*?meta: "${meta}"`));
    return position;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((tabsSource.match(/href: "\/settings\//g) ?? []).length, 5);
});

test("all five account routes render the shared tab component with the correct active page", () => {
  assert.match(accountSectionsSource, /<AccountTabs activePage=\{activePage\} locale=\{locale\} \/>/);
  assert.match(profilePageSource, /renderSettingsAccountPage\("profile"/);
  assert.match(packagePageSource, /renderSettingsAccountPage\("package"/);
  assert.match(invoicesPageSource, /renderSettingsAccountPage\("invoices"/);
  assert.match(aiUsagePageSource, /<AccountTabs activePage="aiUsage" locale=\{locale\} \/>/);
  assert.match(referralPageSource, /<AccountTabs activePage="referral" locale=\{locale\} \/>/);
});

test("settings pages no longer keep separate manual tab lists", () => {
  for (const [file, source] of [
    ["src/app/settings/AccountSections.tsx", accountSectionsSource],
    ["src/app/settings/ai-usage/page.tsx", aiUsagePageSource],
    ["src/app/settings/referral/page.tsx", referralPageSource],
  ]) {
    assert.doesNotMatch(source, /const\s+(ACCOUNT_TABS|accountTabs|SETTINGS_ACCOUNT_TABS)\s*=\s*\[/, file);
  }
});
