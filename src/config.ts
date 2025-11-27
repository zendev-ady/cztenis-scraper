import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    // Scraping
    baseUrl: 'https://cztenis.cz',
    requestDelay: 2000, // 2 seconds between requests
    maxRetries: 3,
    timeout: 30000,

    // Database
    dbPath: path.resolve(process.cwd(), 'data', 'cztenis.db'),

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',

    // User Agent
    userAgent: 'CzTenisH2H-Bot/1.0 (personal project; contact@example.com)',
};
