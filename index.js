// index.js

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// --- CONFIGURATION ---
// You MUST update these values for your specific websites.
const WEBSITE_A_URL = 'https://app6-0.vercel.app/';
const WEBSITE_B_URL = 'https://prod-pramaan.vercel.app/';

// *** NEW: WEBSITE B LOGIN CREDENTIALS ***
const WEBSITE_B_USERNAME = 'Admin';
const WEBSITE_B_PASSWORD = 'Admin@2025';

// Selectors are how Puppeteer finds elements on a page.
// You need to find the correct ones by inspecting the elements in your browser.
const PDF_DOWNLOAD_SELECTOR = '#download-pdf-button'; // e.g., a button with id="download-pdf-button"
// *** UPDATED: WEBSITE B LOGIN SELECTORS - Using XPath to find inputs by their labels ***
const WEBSITE_B_USERNAME_SELECTOR = "::-p-xpath(//label[contains(., 'Username')]/following-sibling::div/input)";
const WEBSITE_B_PASSWORD_SELECTOR = "::-p-xpath(//label[contains(., 'Password')]/following-sibling::div/input)";
const WEBSITE_B_LOGIN_BUTTON_SELECTOR = 'button[type="submit"]'; // e.g., button with type="submit"
const HTML_UPLOAD_SELECTOR = 'input[type="file"][accept*="html"]'; // The hidden HTML file input
const PDF_UPLOAD_SELECTOR = 'input[type="file"][accept*="pdf"]'; // The hidden PDF file input
const SUBMIT_BUTTON_SELECTOR = '#submit-form-button'; // The button to click after uploading

// *** PASTE THE SELECTOR YOU COPIED FROM THE BROWSER HERE ***
// This is an XPath selector that finds a button containing the text "Full File Review", ignoring case.
const FULL_FILE_REVIEW_BUTTON_SELECTOR = "::-p-xpath(//*[normalize-space(.)='FULL FILE REVIEW'])";

const DOWNLOAD_PATH = path.resolve(__dirname, 'downloads');
const SAVED_HTML_PATH = path.join(DOWNLOAD_PATH, 'saved-page.html');
// We will determine the PDF path dynamically after it's downloaded.
// --- END CONFIGURATION ---

/**
 * This function navigates to Website A, saves its HTML, and downloads the PDF.
 * @param {import('puppeteer').Browser} browser - The Puppeteer browser instance.
 * @returns {Promise<string>} - The File path of the downloaded PDF.
 */
async function processWebsiteA(browser) {
    logger.log('--- Starting Website A ---');
    const page = await browser.newPage();

    // Configure the page to download Files to our 'downloads' folder
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: DOWNLOAD_PATH,
    });

    logger.log(`Navigating to ${WEBSITE_A_URL}...`);
    await page.goto(WEBSITE_A_URL, { waitUntil: 'networkidle2' });

    // 1. Save the page as HTML
    logger.log('Saving page content as HTML...');
    const htmlContent = await page.content();
    fs.writeFileSync(SAVED_HTML_PATH, htmlContent);
    logger.log(`HTML saved to: ${SAVED_HTML_PATH}`);

    // 2. Download the PDF
    logger.log('Finding and clicking the PDF download link...');
    // We listen for the 'response' event to find out the name of the downloaded File.
    let downloadedPdfPath = '';
    page.on('response', (response) => {
        const disposition = response.headers()['content-disposition'];
        if (disposition && disposition.includes('attachment')) {
            const FilenameMatch = disposition.match(/Filename="(.+?)"/);
            if (FilenameMatch && FilenameMatch[1].endsWith('.pdf')) {
                const pdfFilename = FilenameMatch[1];
                downloadedPdfPath = path.join(DOWNLOAD_PATH, pdfFilename);
                logger.log(`PDF download detected: ${pdfFilename}`);
            }
        }
    });

    await page.waitForSelector(PDF_DOWNLOAD_SELECTOR);
    await page.click(PDF_DOWNLOAD_SELECTOR);

    // Wait a bit for the download to complete. This might need adjustment.
    logger.log('Waiting for download to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    if (!downloadedPdfPath) {
        throw new Error('Could not determine the downloaded PDF File path. The download may have failed or the Filename was not detected.');
    }
    
    logger.success(`PDF successFully downloaded to: ${downloadedPdfPath}`);
    await page.close();
    logger.log('--- Finished Website A ---');
    return downloadedPdfPath;
}

/**
 * Validates that a list of fields in the "Subject" section are not empty.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 */
// async function validateSubjectFields(page) {
//     logger.log('\n--- Validating Subject Fields ---');

//     const fieldsToValidate = [
//         'Property Address',
//         'City',
//         'County',
//         'State',
//         'Zip Code',
//         'Borrower',
//         'Owner of Public Record',
//         'Legal Description',
//         "Assessor's Parcel #",
//         'Tax Year',
//         'R.E. Taxes $',
//         'Neighborhood Name',
//         'Map Reference',
//         'Census Tract',
//         'Occupant',
//         'Special Assessments $',
//         'PUD',
//         'HOA $',
//         'Property Rights Appraised',
//         'Assignment Type',
//         'Lender/Client',
//         'Address (Lender/Client)',
//         'Offered for Sale in Last 12 Months',
//         'Report data source(s) used, offering price(s), and date(s)',
//     ];

//     for (const fieldName of fieldsToValidate) {
//         // This XPath finds the label containing the field name, then finds the associated input/value field.
//         const valueSelector = `::-p-xpath(//label[contains(., "${fieldName}")]/following-sibling::div//div[contains(@class, 'editable-field-value')])`;
//         const valueElement = await page.$(valueSelector);
//         const value = valueElement ? await page.evaluate(el => el.textContent.trim(), valueElement) : null;

//         logger.log(`[${value ? '✅' : '❌'}] ${fieldName}: ${value || '--- EMPTY ---'}`);
//     }
//     logger.log('--- Subject Field Validation Complete ---');
// }

/**
 * A helper function that waits for a selector to be visible, then clicks it.
 * @param {import('puppeteer').Page} page
 * @param {string} selector
 * @param {string} elementNameForLog
 */
async function waitAndClick(page, selector, elementNameForLog, retries = 3) {
    logger.log(`Waiting for and clicking "${elementNameForLog}"...`);
    for (let i = 0; i <= retries; i++) {
        try {
            // If it's a sidebar item, first ensure the sidebar itself is scrolled into view.
            if (elementNameForLog.includes('sidebar item')) {
                const sidebarContainerSelector = "::-p-xpath(//div[contains(@class, 'sidebar')])";
                const sidebarContainer = await page.waitForSelector(sidebarContainerSelector);
                await sidebarContainer.evaluate(el => el.scrollIntoView());
            }
            // Wait for the specific element to be present, scroll it into view, and then click.
            const element = await page.waitForSelector(selector, { timeout: 30000 });
            await element.scrollIntoView();
            await element.click();
            logger.success(`"${elementNameForLog}" clicked successfully.`);
            return; // Success, exit the loop
        } catch (error) {
            logger.warn(`Attempt ${i + 1} failed for "${elementNameForLog}". Error: ${error.message}`);
            if (i < retries) {
                const delay = 5000; // 5 second delay before retrying
                logger.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.warn(`Skipping "${elementNameForLog}" after all attempts failed.`);
                return; // Skip this item and continue
            }
        }
    }
}
/**
 * Clicks a sidebar item, waits for its corresponding spinner to appear and then disappear.
 * This function is flexible and handles sections with different loading times.
 * @param {import('puppeteer').Page} page
 * @param {string} sectionName - The text of the sidebar item to click.
 * @param {number} timeout - The maximum time to wait in milliseconds.
 */
async function processSidebarItem(page, sectionName, timeout) {
    logger.log(`--- Processing Sidebar Item: ${sectionName} (Timeout: ${timeout / 1000}s) ---`);
    const startTime = Date.now();

    // Use translate() to make the text comparison case-insensitive.
    const sidebarSelector = `::-p-xpath(//div[contains(@class, 'sidebar')]//a[.//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${sectionName.toLowerCase()}')]])`;
    await waitAndClick(page, sidebarSelector, `${sectionName} sidebar item`);

    const spinnerSelector = `::-p-xpath(//div[contains(@class, 'sidebar')]//a[.//span[contains(text(), '${sectionName}')]]//*[contains(@class, 'MuiCircularProgress-root')])`;

    // First, wait for the section-specific spinner to appear. This confirms processing has started.
    logger.log(`Waiting for ${sectionName} processing to begin...`);
    try {
        // Use a shorter timeout here. If the spinner doesn't appear quickly, we assume it won't.
        await page.waitForSelector(spinnerSelector, { visible: true, timeout: 3000 });
        logger.log(`Spinner for ${sectionName} appeared.`);
    } catch (e) {
        logger.warn(`Spinner for ${sectionName} did not appear. Clicking again to ensure extraction starts.`);
        await waitAndClick(page, sidebarSelector, `${sectionName} sidebar item (2nd attempt)`);
    }

    // Now, wait for the section-specific spinner to disappear.
    logger.log(`Waiting for ${sectionName} processing to complete...`);
    await page.waitForSelector(spinnerSelector, { hidden: true, timeout: timeout });

    // Finally, wait for any global loading indicators to also disappear to ensure the page is fully idle.
    const mainLoadingIndicatorSelector = "::-p-xpath(//*[contains(@class, 'MuiCircularProgress-root')])";
    await page.waitForSelector(mainLoadingIndicatorSelector, { hidden: true, timeout: timeout });

    const endTime = Date.now();
    const durationInSeconds = ((endTime - startTime) / 1000).toFixed(2);
    logger.success(`Extraction of ${sectionName} section completed in ${durationInSeconds}s.`);
}
/**
 * This function navigates to Website B and uploads the Files.
 * @param {import('puppeteer').Browser} browser - The Puppeteer browser instance.
 * @param {string} pdfFilePath - The path to the PDF File to upload.
 * @param {string} htmlFilePath - The path to the HTML File to upload.
 */
async function processWebsiteB(browser, pdfFilePath, htmlFilePath) {
    logger.log('\n--- Starting Website B ---');
    const page = await browser.newPage();

    // NEW: Configure the page to download Files to our 'downloads' folder
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: DOWNLOAD_PATH,
    });

    logger.log(`Navigating to ${WEBSITE_B_URL}...`);
    await page.goto(WEBSITE_B_URL, { waitUntil: 'networkidle2' });

    // --- NEW: LOGIN LOGIC ---
    logger.log('Attempting to log in...');
    try {
        // Wait for the login page title to confirm we are on the right page.
        const loginTitleSelector = "::-p-xpath(//*[normalize-space(.)='DJRB Review'])";
        await page.waitForSelector(loginTitleSelector, { timeout: 10000 });
        logger.log('Login page title "DJRB Review" found.');

        // Wait for the username field to be visible, which indicates a login page.
        await page.waitForSelector(WEBSITE_B_USERNAME_SELECTOR, { timeout: 30000 });
        logger.log('Login form found. Entering credentials...');

        await page.type(WEBSITE_B_USERNAME_SELECTOR, WEBSITE_B_USERNAME);
        await page.type(WEBSITE_B_PASSWORD_SELECTOR, WEBSITE_B_PASSWORD);

        await page.click(WEBSITE_B_LOGIN_BUTTON_SELECTOR);
        logger.log('Login button clicked. Waiting for response...');

        // After clicking, wait for one of two things to happen:
        // 1. The welcome text appears (successful login).
        // 2. An error message appears (failed login).
        const welcomeTextSelector = "::-p-xpath(//*[contains(text(), 'Welcome to Appraisal Tools')])";
        const loginErrorSelector = "::-p-xpath(//*[contains(@class, 'MuiAlert-root') and contains(., 'Invalid')])";

        // Use Promise.race as a fallback for older Puppeteer versions that don't have page.waitForRace()
        await Promise.race([
            page.waitForSelector(welcomeTextSelector),
            page.waitForSelector(loginErrorSelector),
        ]);

        // Now, check which one was found.
        if (await page.$(loginErrorSelector)) {
            throw new Error('Login failed. The page displayed an "Invalid" credentials error.');
        }

        logger.success('Login successful! Welcome text found.');
    } catch (error) {
        throw new Error(`Login failed. Please check your credentials. Original error: ${error.message}`);
    }

    // It's good practice to wait for the network to be idle after an action.
    await page.waitForNetworkIdle({ idleTime: 500 });

    // 2. Find and click on the "Full File Review" element.
    await waitAndClick(page, FULL_FILE_REVIEW_BUTTON_SELECTOR, "Full File Review");

    // --- New steps for the extractor page ---

    // 3. Wait for the new page to load by waiting for the PDF upload button to be visible.
    logger.log('Waiting for the extractor page to load...');
    const selectPdfButtonSelector = "::-p-xpath(//button[contains(., 'Select PDF File')])";
    await page.waitForSelector(selectPdfButtonSelector);
    logger.log('Extractor page loaded.');

    // 4. Set the Form Type to ensure all necessary sections are visible.
    // '1004' is a common condo form and should make the 'CONDO/CO-OP' section appear.
    logger.log("Setting Form Type to '1004'...");
    const formTypeDropdownSelector = '#form-type-select';
    await page.waitForSelector(formTypeDropdownSelector);
    await page.click(formTypeDropdownSelector); // Open the dropdown
    const formTypeOptionSelector = `li[data-value='1004']`;
    await waitAndClick(page, formTypeOptionSelector, "Form Type '1004'");

    // 4. Upload the PDF file.
    logger.log('Uploading PDF file...');
    const pdfUploadInput = await page.waitForSelector(PDF_UPLOAD_SELECTOR);
    await pdfUploadInput.uploadFile(pdfFilePath);
    logger.log('PDF file selected.');

    // Wait for the main loading indicator to disappear after PDF upload.
    logger.log('Waiting for initial PDF processing to complete...');
    const mainLoadingIndicatorSelector = "::-p-xpath(//*[contains(@class, 'MuiCircularProgress-root')])";
    await page.waitForSelector(mainLoadingIndicatorSelector, { hidden: true, timeout: 180000 }); // Wait up to 3 minutes

    // Define timeouts for each section in milliseconds
    const TIMEOUTS = {
        INITIAL: 900000, // 15 minutes
        LONG: 600000,    // 10 minutes
        NORMAL: 180000   // 3 minutes
    };

    await processSidebarItem(page, 'Subject', TIMEOUTS.INITIAL);

    // NEW: Wait for the popup and click the "Extract Contract" button.
    // First, wait for the dialog itself to appear.
    const dialogSelector = "::-p-xpath(//div[@role='dialog'])";
    logger.log('Waiting for the contract dialog to appear...');
    await page.waitForSelector(dialogSelector, { visible: true });
    logger.log('Contract dialog is visible.');
    const extractContractButtonSelector = "::-p-xpath(//div[contains(@role, 'dialog')]//button[contains(., 'Extract Contract')])";
    await waitAndClick(page, extractContractButtonSelector, "Extract Contract");

    logger.log('Waiting for contract extraction to complete...');
    await page.waitForSelector(mainLoadingIndicatorSelector, { hidden: true, timeout: 180000 }); // Wait up to 3 minutes
    logger.log('Contract extraction completed.');

    // The "Contract" section is already loaded by the "Extract Contract" button, so we can use a short timeout.
    await processSidebarItem(page, 'Contract', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Neighborhood', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Site', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Improvements', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Sales Comparison & History', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Info of Sales', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Sales History', TIMEOUTS.LONG);
    await processSidebarItem(page, 'RECONCILIATION', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Cost Approach', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Income Approach', TIMEOUTS.LONG);
    await processSidebarItem(page, 'PUD Information', TIMEOUTS.LONG);
    await processSidebarItem(page, 'Market Conditions', TIMEOUTS.LONG);
    await processSidebarItem(page, 'CONDO/CO-OP', TIMEOUTS.LONG);
    await processSidebarItem(page, 'CERTIFICATION', TIMEOUTS.LONG);  

    // --- Download Final PDF ---
    logger.log('\n--- Generating and Storing Final PDF ---');

    // We listen for the 'response' event to find out the name of the downloaded File.
    let finalPdfPath = '';
    const downloadPromise = new Promise(resolve => {
        page.on('response', (response) => {
            const disposition = response.headers()['content-disposition'];
            if (disposition && disposition.includes('attachment')) {
                const filenameMatch = disposition.match(/filename="(.+?)"/i);
                if (filenameMatch && filenameMatch[1].endsWith('.pdf')) {
                    const pdfFilename = filenameMatch[1];
                    finalPdfPath = path.join(DOWNLOAD_PATH, pdfFilename);
                    logger.log(`Final PDF download detected: ${pdfFilename}`);
                    resolve();
                }
            }
        });
    });

    // NEW: Click the "Generate PDF" button after all sections are processed.
    const generatePdfButtonSelector = "::-p-xpath(//button[contains(., 'Generate PDF')])";
    await waitAndClick(page, generatePdfButtonSelector, "Generate PDF");

    const generateerrorlogButtonSelector = "::-p-xpath(//button[contains(., 'Generate Error Log')])";
    await waitAndClick(page, generateerrorlogButtonSelector, "Generate Error Log");
    logger.log('Waiting for final PDF download to start...');
    await downloadPromise; // Wait for the download to be detected.

    // Add a small delay to ensure the file is fully written to disk.
    await new Promise(resolve => setTimeout(resolve, 5000));
    logger.success(`Final PDF successfully stored at: ${finalPdfPath}`);
}

// --- Main Execution ---
(async () => {
    let browser;
    try {
        // Initialize the logger
        logger.init();

        logger.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: false, // Set to 'true' to run in the background, 'false' to watch it happen.
            slowMo: 10,      // Slows down Puppeteer operations by 20ms to make it easier to see.
            protocolTimeout: 600000, // Increase protocol timeout to 10 minutes to handle long-running tasks
            args: [
                '--start-maximized', // This will launch the browser in a maximized window.
                '--disable-dev-shm-usage', // Recommended for running in Docker, but good for stability.
                '--no-sandbox', // Often required in CI environments.
                '--js-flags=--max-old-space-size=16384' // Increase V8's heap size to 16GB.
            ]
        });

        // Find all PDF files in the downloads directory to process them one by one.
        const filesInDownloads = fs.readdirSync(DOWNLOAD_PATH);
        const pdfFiles = filesInDownloads.filter(file => file.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            throw new Error(`No PDF files found in the '${DOWNLOAD_PATH}' directory.`);
        }

        logger.log(`Found ${pdfFiles.length} PDF file(s) to process: ${pdfFiles.join(', ')}`);

        const htmlFilePath = SAVED_HTML_PATH;
        if (!fs.existsSync(htmlFilePath)) {
            throw new Error(`Required HTML file not found: ${htmlFilePath}`);
        }

        for (const pdfFile of pdfFiles) {
            const pdfFilePath = path.join(DOWNLOAD_PATH, pdfFile);
            logger.log(`\n--- Starting workflow for: ${pdfFile} ---`);
            await processWebsiteB(browser, pdfFilePath, htmlFilePath);
            logger.success(`--- Finished workflow for: ${pdfFile} ---`);
        }

        logger.success('\n✅ All files processed successfully!');

    } catch (error) {
        logger.error(`❌ An error occurred during the automation workflow: ${error.stack}`);
    } finally {
        if (browser) {
            logger.log('Closing browser...');
            await browser.close();
        }
    }
})();
