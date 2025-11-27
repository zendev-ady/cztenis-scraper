import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'cztenis.db');
const db = new Database(dbPath);

console.log('Starting migration: Adding depth tracking to scrape_queue...');

try {
    // Check if columns already exist
    const tableInfo = db.pragma('table_info(scrape_queue)');
    const hasDepth = tableInfo.some((col: any) => col.name === 'depth');
    const hasSourcePlayerId = tableInfo.some((col: any) => col.name === 'source_player_id');

    if (hasDepth && hasSourcePlayerId) {
        console.log('✓ Columns already exist, skipping migration.');
        process.exit(0);
    }

    // Start transaction
    db.prepare('BEGIN').run();

    if (!hasDepth) {
        console.log('Adding depth column...');
        db.prepare('ALTER TABLE scrape_queue ADD COLUMN depth INTEGER DEFAULT 0 NOT NULL').run();
        console.log('✓ depth column added');
    }

    if (!hasSourcePlayerId) {
        console.log('Adding source_player_id column...');
        db.prepare('ALTER TABLE scrape_queue ADD COLUMN source_player_id INTEGER REFERENCES players(id)').run();
        console.log('✓ source_player_id column added');
    }

    // Commit transaction
    db.prepare('COMMIT').run();

    console.log('✓ Migration completed successfully!');
} catch (error) {
    console.error('Migration failed:', error);
    db.prepare('ROLLBACK').run();
    process.exit(1);
} finally {
    db.close();
}
