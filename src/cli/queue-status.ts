import { db } from '../database/index';
import { scrapeQueue } from '../database/schema';
import { sql } from 'drizzle-orm';

console.log('\n=== Scrape Queue Status ===\n');

const queue = db.select().from(scrapeQueue).all();
console.log(`Total items: ${queue.length}`);

if (queue.length > 0) {
  console.log('\nFirst 10 items:');
  queue.slice(0, 10).forEach(item => {
    console.log(`  Player ${item.playerId}: depth=${item.depth}, source=${item.sourcePlayerId || 'manual'}, status=${item.status}`);
  });

  console.log('\n--- Depth Distribution ---');
  const depthCounts = queue.reduce((acc: Record<number, number>, item) => {
    const depth = item.depth || 0;
    acc[depth] = (acc[depth] || 0) + 1;
    return acc;
  }, {});

  Object.entries(depthCounts).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([depth, count]) => {
    console.log(`  Depth ${depth}: ${count} players`);
  });

  console.log('\n--- Status Distribution ---');
  const statusCounts = queue.reduce((acc: Record<string, number>, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} players`);
  });
}

console.log('');
