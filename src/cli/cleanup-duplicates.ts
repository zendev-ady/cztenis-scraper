#!/usr/bin/env node

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../database/index';
import { matches, players } from '../database/schema';
import { logger } from '../utils/logger';

interface DuplicateGroup {
    tournamentId: number;
    round: string;
    player1Id: number;
    player2Id: number;
    matchType: string;
    count: number;
    matchIds: number[];
}

async function findDuplicateMatches(): Promise<DuplicateGroup[]> {
    console.log('🔍 Finding duplicate matches...\n');

    const duplicates = await db.all(sql`
        SELECT 
            tournament_id as tournamentId,
            round,
            player1_id as player1Id,
            player2_id as player2Id,
            match_type as matchType,
            COUNT(*) as count,
            GROUP_CONCAT(id) as matchIds
        FROM matches
        GROUP BY tournament_id, round, player1_id, player2_id, match_type
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    `);

    return (duplicates as any[]).map(d => ({
        ...d,
        matchIds: d.matchIds.split(',').map((id: string) => parseInt(id, 10)),
    }));
}

async function deleteDuplicates(duplicates: DuplicateGroup[], dryRun: boolean): Promise<number> {
    let deletedCount = 0;

    for (const dup of duplicates) {
        // Keep the first match (lowest ID), delete the rest
        const idsToDelete = dup.matchIds.slice(1);

        console.log(`\n📋 Duplicate group: Tournament ${dup.tournamentId}, Round ${dup.round}`);
        console.log(`   Players: ${dup.player1Id} vs ${dup.player2Id} (${dup.matchType})`);
        console.log(`   Found ${dup.count} duplicates, keeping ID ${dup.matchIds[0]}, deleting: ${idsToDelete.join(', ')}`);

        if (!dryRun) {
            for (const id of idsToDelete) {
                await db.delete(matches).where(eq(matches.id, id)).run();
                deletedCount++;
            }
        } else {
            deletedCount += idsToDelete.length;
        }
    }

    return deletedCount;
}

async function findOrphanedMatches(): Promise<number[]> {
    console.log('\n🔍 Finding orphaned matches (missing player references)...\n');

    // Find matches where player1Id or player2Id doesn't exist in players table
    const orphaned = await db.all(sql`
        SELECT m.id
        FROM matches m
        LEFT JOIN players p1 ON m.player1_id = p1.id
        LEFT JOIN players p2 ON m.player2_id = p2.id
        WHERE p1.id IS NULL OR p2.id IS NULL
    `);

    return (orphaned as any[]).map(o => o.id);
}

async function findInvalidMatches(): Promise<{ id: number; reason: string }[]> {
    console.log('\n🔍 Finding invalid matches...\n');

    const invalid: { id: number; reason: string }[] = [];

    // Find matches with same player on both sides
    const samePlayer = await db.all(sql`
        SELECT id, player1_id, player2_id
        FROM matches
        WHERE player1_id = player2_id
    `);

    for (const m of samePlayer as any[]) {
        invalid.push({ id: m.id, reason: `Same player on both sides: ${m.player1_id}` });
    }

    // Find matches with NULL player IDs
    const nullPlayers = await db.all(sql`
        SELECT id
        FROM matches
        WHERE player1_id IS NULL OR player2_id IS NULL
    `);

    for (const m of nullPlayers as any[]) {
        invalid.push({ id: m.id, reason: 'NULL player ID' });
    }

    return invalid;
}

async function analyzePlayerMatchesInTournament(playerId: number, tournamentId: number) {
    console.log(`\n📊 Analyzing player ${playerId} in tournament ${tournamentId}...\n`);

    const playerMatches = await db.select()
        .from(matches)
        .where(and(
            eq(matches.tournamentId, tournamentId),
            sql`(player1_id = ${playerId} OR player2_id = ${playerId})`
        ))
        .orderBy(matches.round)
        .all();

    console.log(`Found ${playerMatches.length} matches:\n`);

    const roundCounts = new Map<string, number>();

    for (const match of playerMatches) {
        const isPlayer1 = match.player1Id === playerId;
        const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
        const isWinner = match.winnerId === playerId;

        roundCounts.set(match.round, (roundCounts.get(match.round) || 0) + 1);

        console.log(`  ${match.round}: vs ${opponentId} (${match.score}) - ${isWinner ? '✅ WIN' : '❌ LOSS'} [ID: ${match.id}]`);
    }

    console.log('\nRound distribution:');
    for (const [round, count] of Array.from(roundCounts)) {
        const status = count > 1 ? '⚠️ DUPLICATE' : '✅';
        console.log(`  ${round}: ${count} match(es) ${status}`);
    }
}

async function main() {
    const args = process.argv.slice(2);

    let dryRun = true;
    let analyzePlayer: number | undefined;
    let analyzeTournament: number | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--execute') {
            dryRun = false;
        } else if (arg === '--analyze-player' && args[i + 1]) {
            analyzePlayer = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--analyze-tournament' && args[i + 1]) {
            analyzeTournament = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
    }

    console.log('🧹 Cleanup Duplicates Tool\n');
    console.log(dryRun ? '⚠️ DRY RUN MODE - No changes will be made\n' : '🔴 EXECUTE MODE - Changes will be applied!\n');

    try {
        // If analyzing specific player/tournament
        if (analyzePlayer && analyzeTournament) {
            await analyzePlayerMatchesInTournament(analyzePlayer, analyzeTournament);
            process.exit(0);
        }

        // 1. Find and handle duplicate matches
        const duplicates = await findDuplicateMatches();
        console.log(`Found ${duplicates.length} duplicate groups`);

        if (duplicates.length > 0) {
            const deletedCount = await deleteDuplicates(duplicates, dryRun);
            console.log(`\n${dryRun ? 'Would delete' : 'Deleted'} ${deletedCount} duplicate matches`);
        }

        // 2. Find orphaned matches
        const orphaned = await findOrphanedMatches();
        console.log(`\nFound ${orphaned.length} orphaned matches (missing player references)`);

        if (orphaned.length > 0 && !dryRun) {
            for (const id of orphaned) {
                await db.delete(matches).where(eq(matches.id, id)).run();
            }
            console.log(`Deleted ${orphaned.length} orphaned matches`);
        }

        // 3. Find invalid matches
        const invalid = await findInvalidMatches();
        console.log(`\nFound ${invalid.length} invalid matches:`);

        for (const inv of invalid) {
            console.log(`  ID ${inv.id}: ${inv.reason}`);
        }

        if (invalid.length > 0 && !dryRun) {
            for (const inv of invalid) {
                await db.delete(matches).where(eq(matches.id, inv.id)).run();
            }
            console.log(`Deleted ${invalid.length} invalid matches`);
        }

        // Summary
        console.log('\n=== SUMMARY ===');
        console.log(`Duplicate groups: ${duplicates.length}`);
        console.log(`Orphaned matches: ${orphaned.length}`);
        console.log(`Invalid matches: ${invalid.length}`);

        if (dryRun && (duplicates.length > 0 || orphaned.length > 0 || invalid.length > 0)) {
            console.log('\n💡 To apply changes, run with --execute flag');
        }

        process.exit(0);
    } catch (error) {
        logger.error('Cleanup failed', { error });
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
Usage: npx ts-node src/cli/cleanup-duplicates.ts [options]

Options:
  --execute                         Actually delete duplicates (default: dry run)
  --analyze-player <id>             Analyze specific player's matches
  --analyze-tournament <id>         Analyze specific tournament (use with --analyze-player)
  --help, -h                        Show this help message

Examples:
  # Dry run - show what would be deleted
  npx ts-node src/cli/cleanup-duplicates.ts

  # Actually delete duplicates
  npx ts-node src/cli/cleanup-duplicates.ts --execute

  # Analyze specific player in tournament
  npx ts-node src/cli/cleanup-duplicates.ts --analyze-player 1026900 --analyze-tournament 123456

Cleanup actions:
  1. Remove duplicate matches (keeps oldest, deletes newer duplicates)
  2. Remove orphaned matches (where player doesn't exist)
  3. Remove invalid matches (same player both sides, null player IDs)
`);
}

main();
