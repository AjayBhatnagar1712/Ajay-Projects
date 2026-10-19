import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const websiteDir = path.resolve(import.meta.dirname);
const distIndex = path.join(websiteDir, "dist", "index.html");
const GTM_LOADER_PREFIX = "googletagmanager.com/gtm.js?id=";
const GTM_CONTAINER_ID = "GTM-T679X9X7";
const GTM_NOSCRIPT_URL = "googletagmanager.com/ns.html?id=GTM-T679X9X7";
const BUILD_TEST_TIMEOUT_MS = 60_000;

function runWebsiteBuild(env: NodeJS.ProcessEnv): void {
  execSync("pnpm run build", {
    cwd: websiteDir,
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}

describe("marketing analytics dist output", () => {
  afterEach(() => {
    rmSync(path.join(websiteDir, "dist"), { recursive: true, force: true });
  });

  it("omits GTM when VITE_ENABLE_ANALYTICS is unset", { timeout: BUILD_TEST_TIMEOUT_MS }, () => {
    runWebsiteBuild({ VITE_ENABLE_ANALYTICS: undefined });
    const html = readFileSync(distIndex, "utf8");
    expect(html).not.toContain("GTM-T679X9X7");
    expect(html).not.toContain(GTM_LOADER_PREFIX);
    expect(html).not.toContain("googletagmanager.com/gtag/js");
    expect(html).not.toContain("G-72DKWMCJ1R");
    expect(html).not.toContain("AW-18274047914");
  });

  it("includes GTM when VITE_ENABLE_ANALYTICS=1", { timeout: BUILD_TEST_TIMEOUT_MS }, () => {
    runWebsiteBuild({ VITE_ENABLE_ANALYTICS: "1" });
    const html = readFileSync(distIndex, "utf8");
    expect(html).toContain(GTM_LOADER_PREFIX);
    expect(html).toContain(GTM_CONTAINER_ID);
    expect(html).toContain(GTM_NOSCRIPT_URL);
    expect(html).not.toContain("googletagmanager.com/gtag/js");
    expect(html).not.toContain("G-72DKWMCJ1R");
    expect(html).not.toContain("AW-18274047914");
    expect(html).toContain("Google Tag Manager (noscript)");
  });
});
