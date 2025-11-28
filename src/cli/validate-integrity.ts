#!/usr/bin/env node

import { TournamentIntegrityValidator } from '../validators/tournament-integrity';
import { logger } from '../utils/logger';

async function main() {
    const args = process.argv.slice(2);
    
    // Parse arguments
    let playerId: number | undefined;
    let tournamentId: number | undefined;
    let limit = 100;
    let outputJson = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--player' && args[i + 1]) {
            playerId = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--tournament' && args[i + 1]) {
            tournamentId = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--json') {
            outputJson = true;
        } else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
    }

    console.log('🔍 Starting data integrity validation...\n');

    const validator = new TournamentIntegrityValidator();

    try {
        const options = {
            playerId,
            tournamentId,
            limit,
        };

        if (playerId) {
            console.log(`Validating player: ${playerId}`);
        } else if (tournamentId) {
            console.log(`Validating tournament: ${tournamentId}`);
        } else {
            console.log(`Validating top ${limit} players by match count`);
        }

        console.log('');

        const report = await validator.validateAll(options);

        if (outputJson) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(validator.generateReport(report));
        }

        // Exit with error code if there are errors
        if (report.summary.errors > 0) {
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        logger.error('Validation failed', { error });
        console.error('\n❌ Validation failed:', error);
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
Usage: npx ts-node src/cli/validate-integrity.ts [options]

Options:
  --player <id>       Validate specific player by ID
  --tournament <id>   Validate specific tournament by ID
  --limit <n>         Limit number of players to check (default: 100)
  --json              Output results as JSON
  --help, -h          Show this help message

Examples:
  # Validate all (top 100 players by match count)
  npx ts-node src/cli/validate-integrity.ts

  # Validate specific player
  npx ts-node src/cli/validate-integrity.ts --player 1026900

  # Validate specific tournament
  npx ts-node src/cli/validate-integrity.ts --tournament 123456

  # Output as JSON
  npx ts-node src/cli/validate-integrity.ts --player 1026900 --json

Validation Rules:
  RULE_1: One match per round per player (in knockout rounds)
  RULE_2: Winner continuity - if won round N, should have match in N+1
  RULE_3: No match after loss - if lost in round N, no matches in N+1
  RULE_4: Score consistency - winner should have more sets
  DUPLICATE_MATCH: No duplicate match entries
`);
}

main();
