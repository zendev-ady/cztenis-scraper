import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    // Scraping - OPTIMIZED
    baseUrl: 'https://cztenis.cz',
    requestDelay: 500,  // Reduced from 2000ms to 500ms (HTTP is faster than Playwright)
    maxRetries: 3,
    timeout: 30000,

    // Adaptive Rate Limiting
    minDelay: 300,      // Minimum delay between requests (ms)
    maxDelay: 5000,     // Maximum delay when errors occur (ms)

    // Database
    dbPath: path.resolve(process.cwd(), 'data', 'cztenis.db'),

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE,

    // User Agent
    userAgent: 'CzTenisH2H/1.0 (student project; adam@example.com)',
};
