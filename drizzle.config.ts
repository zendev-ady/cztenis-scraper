import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';

// Ensure data directory exists
if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
}

export default defineConfig({
    schema: './src/database/schema.ts',
    out: './src/database/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: './data/cztenis.db',
    },
});
