import { type ChildProcess, execSync, spawn } from "node:child_process";
import { request } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";

const websiteDir = path.resolve(import.meta.dirname);
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const BUILD_TEST_TIMEOUT_MS = 120_000;
const PREVIEW_START_TIMEOUT_MS = 30_000;
const PREVIEW_ARGS = [
  "exec",
  "vite",
  "preview",
  "--config",
  "vite.config.ts",
  "--host",
  "127.0.0.1",
  "--port",
];

let previewProcess: ChildProcess | undefined;
let previewPort = 0;
let previewBaseUrl = "";

function runWebsiteBuild(): void {
  execSync("pnpm run build", {
    cwd: websiteDir,
    env: { ...process.env },
    stdio: "pipe",
  });
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate preview port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForPreview(url: string): Promise<void> {
  const deadline = Date.now() + PREVIEW_START_TIMEOUT_MS;

  await new Promise<void>((resolve, reject) => {
    const tryOnce = (): void => {
      const req = request(url, (res) => {
        res.resume();
        if (
          res.statusCode !== undefined &&
          res.statusCode >= 200 &&
          res.statusCode < 500
        ) {
          resolve();
          return;
        }
        if (Date.now() < deadline) {
          setTimeout(tryOnce, 250);
          return;
        }
        reject(
          new Error(`Preview returned status ${res.statusCode ?? "unknown"}`),
        );
      });

      req.on("error", () => {
        if (Date.now() < deadline) {
          setTimeout(tryOnce, 250);
          return;
        }
        reject(new Error(`Preview server did not become ready at ${url}`));
      });

      req.end();
    };

    tryOnce();
  });
}

async function startPreview(): Promise<void> {
  previewPort = await getFreePort();
  previewBaseUrl = `http://127.0.0.1:${previewPort}`;
  const command = process.platform === "win32" ? process.execPath : "pnpm";
  const args =
    process.platform === "win32"
      ? [
          path.join(
            path.dirname(process.execPath),
            "node_modules",
            "corepack",
            "dist",
            "pnpm.js",
          ),
          ...PREVIEW_ARGS,
          String(previewPort),
          "--strictPort",
        ]
      : [...PREVIEW_ARGS, String(previewPort), "--strictPort"];

  previewProcess = spawn(command, args, {
    cwd: websiteDir,
    env: { ...process.env },
    stdio: "pipe",
  });

  await waitForPreview(previewBaseUrl);
}

function stopPreview(): void {
  if (!previewProcess || previewProcess.killed) return;
  previewProcess.kill("SIGTERM");
}

describe("MarketingAuthFlowShell desktop backdrop", () => {
  beforeAll(async () => {
    runWebsiteBuild();
    await startPreview();
  }, BUILD_TEST_TIMEOUT_MS);

  afterAll(() => {
    stopPreview();
  });

  it(
    "dims the homepage hero with a backdrop layer above the peek-through at 1280px",
    { timeout: BUILD_TEST_TIMEOUT_MS },
    async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });

      try {
        await page.goto(`${previewBaseUrl}/login/existing/mock`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector('[aria-label="Welcome back"]', {
          timeout: 15_000,
        });

        const layout = await page.evaluate(() => {
          const isVisible = (element: Element): boolean => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          const desktopShell = [...document.querySelectorAll("div")].find(
            (element) =>
              isVisible(element) &&
              element.classList.contains("lg:fixed") &&
              element.classList.contains("lg:flex"),
          );

          const homePeek = desktopShell?.querySelector(".z-0");
          const backdrop = desktopShell?.querySelector(
            ".z-\\[1\\].bg-\\[\\#2b2b2b\\]\\/70",
          );
          const dialog = desktopShell?.querySelector(
            '[role="dialog"][aria-label="Welcome back"]',
          );
          const heroHeading = [...document.querySelectorAll("h1")].find(
            (element) => element.textContent?.includes("Property management"),
          );

          if (
            !desktopShell ||
            !homePeek ||
            !backdrop ||
            !dialog ||
            !heroHeading
          ) {
            return {
              ok: false,
              hasDesktopShell: !!desktopShell,
              hasHomePeek: !!homePeek,
              hasBackdrop: !!backdrop,
              hasDialog: !!dialog,
              hasHeroHeading: !!heroHeading,
            };
          }

          const heroRect = heroHeading.getBoundingClientRect();
          const dialogRect = dialog.getBoundingClientRect();
          const sampleY = heroRect.top + Math.min(heroRect.height / 2, 40);
          // Sample left of the centered dialog so we hit the dimmed homepage, not the modal.
          const sampleX =
            dialogRect.left > heroRect.left + 24
              ? dialogRect.left - 24
              : heroRect.right + 24;
          const topElement = document.elementFromPoint(sampleX, sampleY);

          return {
            ok: true,
            homePeekZIndex: getComputedStyle(homePeek).zIndex,
            backdropZIndex: getComputedStyle(backdrop).zIndex,
            dialogZIndex: getComputedStyle(dialog).zIndex,
            backdropCoversHero: topElement === backdrop,
            backdropAboveHomePeek:
              homePeek.compareDocumentPosition(backdrop) ===
              Node.DOCUMENT_POSITION_FOLLOWING,
          };
        });

        expect(layout.ok).toBe(true);
        if (!layout.ok) return;

        expect(layout.homePeekZIndex).toBe("0");
        expect(layout.backdropZIndex).toBe("1");
        expect(layout.dialogZIndex).toBe("10");
        expect(layout.backdropAboveHomePeek).toBe(true);
        expect(layout.backdropCoversHero).toBe(true);
      } finally {
        await browser.close();
      }
    },
  );

  it(
    "dismisses signup shell with close button, Escape, and backdrop click",
    { timeout: BUILD_TEST_TIMEOUT_MS },
    async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });

      try {
        await page.goto(`${previewBaseUrl}/signup/role/mock`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector(
          '[role="dialog"][aria-label="Choose your role"]',
          {
            timeout: 15_000,
          },
        );
        await page.getByRole("button", { name: "Close login dialog" }).click();
        await page.waitForURL(`${previewBaseUrl}/`);

        await page.goto(`${previewBaseUrl}/signup/role/mock`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector(
          '[role="dialog"][aria-label="Choose your role"]',
          {
            timeout: 15_000,
          },
        );
        await page.keyboard.press("Escape");
        await page.waitForURL(`${previewBaseUrl}/`);

        await page.goto(`${previewBaseUrl}/signup/role/mock`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector(
          '[role="dialog"][aria-label="Choose your role"]',
          {
            timeout: 15_000,
          },
        );
        await page.mouse.click(24, 24);
        await page.waitForURL(`${previewBaseUrl}/`);
      } finally {
        await browser.close();
      }
    },
  );
});
