import { chromium, type Browser } from "playwright";
import { writeFileSync, statSync } from "node:fs";

type Padding =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number };

function getPaddingValue(
  pad: Padding,
  side: "top" | "right" | "bottom" | "left",
): number {
  if (typeof pad === "number") return pad;
  return pad[side] ?? 0;
}

async function takeScreenshot(
  url: string,
  options: {
    width?: number;
    height?: number;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    elementSelector?: string;
    outputPath?: string;
    headless?: boolean;
    hideElements?: boolean;
    waitForSelector?: string;
    windowSize?: { width: number; height: number };
    padding?: Padding;
  } = {},
): Promise<void> {
  const {
    width = 1280,
    height = 1067,
    fullPage = false,
    clip = null,
    elementSelector = null,
    outputPath = "screenshot.png",
    headless = true,
    hideElements = true,
    waitForSelector = ".main",
    windowSize = null,
    padding = 0,
  } = options;

  // Calculate total viewport with padding (adds space around content)
  const padLeft = getPaddingValue(padding, "left");
  const padRight = getPaddingValue(padding, "right");
  const padTop = getPaddingValue(padding, "top");
  const padBottom = getPaddingValue(padding, "bottom");
  const totalWidth = width + padLeft + padRight;
  const totalHeight = height + padTop + padBottom;

  let browser: Browser | null = null;
  try {
    // Launch args for window size (if provided)
    const launchArgs = headless
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : [];
    if (windowSize && !headless) {
      launchArgs.push(`--window-size=${windowSize.width},${windowSize.height}`);
      console.log(
        `Full window size set to ${windowSize.width}x${windowSize.height} (includes chrome)`,
      );
    }

    console.log(`Launching browser (headless: ${headless})...`);
    browser = await chromium.launch({
      headless,
      args: launchArgs,
    });

    const page = await browser.newPage();

    // Set viewport to total size (content + padding)
    await page.setViewportSize({ width: totalWidth, height: totalHeight });
    console.log(
      `Viewport set to ${totalWidth}x${totalHeight} (includes ${typeof padding === "number" ? padding : "custom"}px padding)`,
    );

    // Verify viewport (TS ignores browser globals in evaluate)
    // @ts-ignore - Runs in browser context where window exists
    const actualSizes = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
    }));
    console.log(
      `Actual sizes confirmed: Viewport ${actualSizes.innerWidth}x${actualSizes.innerHeight} (full window: ${actualSizes.outerWidth}x${actualSizes.outerHeight})`,
    );

    // Load the page
    console.log(`Loading ${url}...`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for specific element
    await page.waitForSelector(waitForSelector, { timeout: 10000 });
    console.log("Content loaded.");

    if (hideElements) {
      await page.addStyleTag({
        content: `
          .screenshot-hidden { display: none !important; }
          .screenshot-capture { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        `,
      });

      // @ts-ignore - Runs in browser context where document exists
      await page
        .evaluate(() => {
          // Hide sidebar (title, author, notes, buttons)
          document
            .querySelector("#sidebar")
            ?.classList.add("screenshot-hidden");
          document
            .querySelector("#metadata")
            ?.classList.add("screenshot-hidden");
          document
            .querySelector(".watermark")
            ?.classList.add("screenshot-hidden");
          document
            .querySelector(".notes-content")
            ?.classList.add("screenshot-hidden");
          document
            .querySelector("#buttons")
            ?.classList.add("screenshot-hidden");

          // Hide EVs/IVs in main (no inline type—let infer Element; textContent is string | null)
          const main = document.querySelector(".main");
          if (main) {
            const lines = main.querySelectorAll(".attribute-line");
            // biome-ignore lint/complexity/noForEach : This is not an array type
            lines.forEach((line) => {
              // To hide EVs & IVs, uncomment the following line.
              // A user could just take a screenshot of an OTS though.
              //
              // if (
              //   line.textContent?.includes("EVs") ||
              //   line.textContent?.includes("IVs")
              // ) {
              //   line.classList.add("screenshot-hidden");
              // }
            });
            main.classList.add("screenshot-capture");
          }
        })
        .catch((err) => {
          console.warn("Hiding elements failed (non-critical):", err.message);
        });

      const main = await page.$(".main");
      if (main) {
        const mainBox = await main.boundingBox();
        if (mainBox && mainBox.height > totalHeight - padTop - padBottom) {
          const scale = Math.min(
            (totalWidth - padLeft - padRight) / mainBox.width,
            (totalHeight - padTop - padBottom) / mainBox.height,
          );
          // @ts-ignore - Runs in browser context
          await page.evaluate((s) => {
            const main: HTMLElement | null = document.querySelector(".main");
            if (main) {
              main.style.transform = `scale(${s})`;
              main.style.transformOrigin = "top left";
            }
          }, scale);
          console.log(`Scaled main to ${scale.toFixed(2)}x (with padding)`);
        }
      }

      // Apply padding via CSS (spaces content from edges)
      const padStr =
        typeof padding === "number"
          ? `${padding}px`
          : `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px`;
      await page.addStyleTag({
        content: `body { padding: ${padStr} !important; margin: 0 !important; background-color: transparent !important; }`,
      });
      console.log(`Padding applied: ${padStr}`);

      console.log("Elements hidden, scaled, and padded.");
    }

    await page.evaluate(() => {
      const EXTRA_TOP = 10;
      const main = document.querySelector<HTMLElement>(".main");
      if (main) {
        // Preserve any existing padding
        const currentPaddingTop =
          Number.parseInt(window.getComputedStyle(main).paddingTop, 10) || 0;
        main.style.paddingTop = `${currentPaddingTop + EXTRA_TOP}px`;
      }
    });

    // Take screenshot (full viewport, including padding)
    let screenshotBuffer: Buffer;
    if (elementSelector) {
      // Screenshot specific element (padding around it via body)
      const element = await page.$(elementSelector);
      if (!element) {
        console.error(`Element ${elementSelector} not found`);
        return;
      }
      screenshotBuffer = await element.screenshot();
      console.log(
        `Screenshot of element ${elementSelector} saved (with padding).`,
      );
    } else if (clip) {
      // Clipped region (adjust clip for padding if needed)
      screenshotBuffer = await page.screenshot({ clip });
      console.log(`Clipped screenshot (${clip.width}x${clip.height}) saved.`);
    } else {
      // Full page (viewport with padding)
      screenshotBuffer = await page.screenshot({ fullPage });
      console.log(
        `Full page screenshot (${totalWidth}x${totalHeight}) saved (includes padding).`,
      );
    }

    // Crop to exact target size (exclude padding from final output)
    const EXTRA_TOP = 10;
    if (padLeft > 0 || padRight > 0 || padTop > 0 || padBottom > 0) {
      const cropClip = {
        x: padLeft,
        y: padTop - EXTRA_TOP,
        width: width,
        height: height,
      };
      const croppedBuffer = await page.screenshot({ clip: cropClip });
      writeFileSync(outputPath, croppedBuffer);
      console.log(
        `Cropped to exact ${width}x${height} (padding excluded from output).`,
      );
    } else {
      writeFileSync(outputPath, screenshotBuffer);
    }

    console.log(
      `Screenshot saved to ${outputPath} (${statSync(outputPath).size} bytes)`,
    );
  } catch (error) {
    console.error("Screenshot failed:", error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
  }
}

const args = process.argv.slice(2);
const id = args[0];
if (!id) {
  throw new Error("No ID provided");
}

const url = `https://pokebin.com/${id}`;
await takeScreenshot(url, {
  width: 1480,
  height: 830,
  fullPage: true,
  outputPath: `${id}.png`,
  headless: true,
  hideElements: true,
  waitForSelector: ".main",
  padding: { top: 20, left: 20, right: 20, bottom: 20 },
});
