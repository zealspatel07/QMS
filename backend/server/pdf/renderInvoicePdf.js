const puppeteer = require("puppeteer-core");

/**
 * Render invoice HTML to PDF using Puppeteer
 * Properly handles HTML tables and CSS styling
 */
async function renderInvoicePdf(html) {
  let browser;
  try {
    // Puppeteer-core doesn't include browser, so we'll try to connect to Chrome
    // Or try launching with system Chrome paths
    const executablePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      process.env.PUPPETEER_EXECUTABLE_PATH,
    ];

    for (const execPath of executablePaths) {
      if (!execPath) continue;
      try {
        browser = await puppeteer.launch({
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
          executablePath: execPath,
          headless: true,
        });
        console.log(`✓ Chrome launched from: ${execPath}`);
        break;
      } catch (e) {
        // Try next path
        continue;
      }
    }

    if (!browser) {
      throw new Error(
        "Chrome/Chromium not found. Please ensure Google Chrome is installed."
      );
    }

    const page = await browser.newPage();

    // Set content with HTML
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });

    // Generate PDF with proper options
    const pdf = await page.pdf({
      format: "A4",
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "10mm",
        right: "10mm",
      },
      printBackground: true,
      scale: 1,
    });

    await page.close();
    return pdf;
  } catch (err) {
    console.error("PDF rendering error:", err);
    throw new Error(`Failed to render PDF: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = renderInvoicePdf;
