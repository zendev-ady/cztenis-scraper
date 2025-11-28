import { eq, and, or, sql, desc } from 'drizzle-orm';
import { db } from '../database/index';
import { matches, players, tournaments } from '../database/schema';
import { logger } from '../utils/logger';
import { determineWinnerFromScore } from '../utils/score-winner';

export type IssueType = 'ERROR' | 'WARNING';

export interface ValidationIssue {
    type: IssueType;
    rule: string;
    playerId: number;
    playerName?: string;
    tournamentId: number;
    tournamentName?: string;
    details: string;
    matchIds?: number[];
}

export interface ValidationReport {
    issues: ValidationIssue[];
    summary: {
        tournamentsChecked: number;
        playersChecked: number;
        errors: number;
        warnings: number;
    };
}

// Standard knockout round order (higher number = earlier round)
const ROUND_ORDER: Record<string, number> = {
    '128>64': 7,
    '64>32': 6,
    '32>16': 5,
    '16>8': 4,
    '8>4': 3,
    '4>2': 2,
    '2>1': 1,
};

// Get round order, return -1 for non-knockout rounds
function getRoundOrder(round: string): number {
    const normalizedRound = round.trim();
    return ROUND_ORDER[normalizedRound] ?? -1;
}

// Get next round (after winning)
function getNextRound(round: string): string | null {
    const order = getRoundOrder(round);
    if (order <= 0) return null;
    
    for (const [r, o] of Object.entries(ROUND_ORDER)) {
        if (o === order - 1) return r;
    }
    return null;
}

export class TournamentIntegrityValidator {
    /**
     * Validate all matches for a specific player in a specific tournament
     */
    async validatePlayerTournament(playerId: number, tournamentId: number): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        // Get player info
        const player = await db.select().from(players).where(eq(players.id, playerId)).get();
        const playerName = player?.name || `Player ${playerId}`;

        // Get tournament info
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        const tournamentName = tournament?.name || `Tournament ${tournamentId}`;

        // Get all matches for this player in this tournament
        const playerMatches = await db.select()
            .from(matches)
            .where(and(
                eq(matches.tournamentId, tournamentId),
                or(
                    eq(matches.player1Id, playerId),
                    eq(matches.player2Id, playerId)
                )
            ))
            .all();

        if (playerMatches.length === 0) {
            return issues;
        }

        // Rule 1: One match per round per player (for knockout rounds only)
        const roundCounts = new Map<string, typeof playerMatches>();
        for (const match of playerMatches) {
            const round = match.round;
            const roundOrder = getRoundOrder(round);
            
            // Only check knockout rounds
            if (roundOrder > 0) {
                if (!roundCounts.has(round)) {
                    roundCounts.set(round, []);
                }
                roundCounts.get(round)!.push(match);
            }
        }

        for (const [round, roundMatches] of Array.from(roundCounts)) {
            if (roundMatches.length > 1) {
                issues.push({
                    type: 'WARNING',
                    rule: 'RULE_1_ONE_MATCH_PER_ROUND',
                    playerId,
                    playerName,
                    tournamentId,
                    tournamentName,
                    details: `Multiple matches in round ${round} (found ${roundMatches.length}, expected max 1)`,
                    matchIds: roundMatches.map(m => m.id),
                });
            }
        }

        // Rule 2 & 3: Tournament progression logic
        // Sort matches by round order (earliest to latest)
        const knockoutMatches = playerMatches
            .filter(m => getRoundOrder(m.round) > 0)
            .sort((a, b) => getRoundOrder(b.round) - getRoundOrder(a.round));

        let lastLossRound: string | null = null;
        let lastLossRoundOrder: number = -1;

        for (const match of knockoutMatches) {
            const round = match.round;
            const roundOrder = getRoundOrder(round);
            const isWinner = match.winnerId === playerId;

            // Rule 3: After losing, player shouldn't have matches in later rounds
            if (lastLossRound !== null && roundOrder < lastLossRoundOrder) {
                issues.push({
                    type: 'ERROR',
                    rule: 'RULE_3_NO_MATCH_AFTER_LOSS',
                    playerId,
                    playerName,
                    tournamentId,
                    tournamentName,
                    details: `Player has match in round ${round} after losing in round ${lastLossRound}`,
                    matchIds: [match.id],
                });
            }

            if (!isWinner) {
                lastLossRound = round;
                lastLossRoundOrder = roundOrder;
            }
        }

        // Rule 2: Winner continuity - if won in round N, should have match in round N+1 (unless it's the final)
        for (const match of knockoutMatches) {
            const round = match.round;
            const roundOrder = getRoundOrder(round);
            const isWinner = match.winnerId === playerId;

            if (isWinner && round !== '2>1') { // Not the final
                const nextRound = getNextRound(round);
                if (nextRound) {
                    const hasNextRoundMatch = knockoutMatches.some(m => m.round === nextRound);
                    if (!hasNextRoundMatch) {
                        issues.push({
                            type: 'WARNING',
                            rule: 'RULE_2_WINNER_CONTINUITY',
                            playerId,
                            playerName,
                            tournamentId,
                            tournamentName,
                            details: `Player won in round ${round} but has no match in next round ${nextRound}`,
                            matchIds: [match.id],
                        });
                    }
                }
            }
        }

        // Rule 4: Score consistency (winner has more sets)
        for (const match of playerMatches) {
            if (match.score && !match.isWalkover) {
                const isPlayer1 = match.player1Id === playerId;
                const calculatedWinnerIsLeft = this.calculateWinnerFromScore(match.score);
                
                if (calculatedWinnerIsLeft !== null) {
                    const calculatedWinnerId = calculatedWinnerIsLeft ? match.player1Id : match.player2Id;
                    
                    if (calculatedWinnerId !== match.winnerId) {
                        issues.push({
                            type: 'WARNING',
                            rule: 'RULE_4_SCORE_CONSISTENCY',
                            playerId,
                            playerName,
                            tournamentId,
                            tournamentName,
                            details: `Score "${match.score}" suggests winner should be ${calculatedWinnerId}, but winnerId is ${match.winnerId}`,
                            matchIds: [match.id],
                        });
                    }
                }
            }
        }

        return issues;
    }

    /**
     * Calculate winner from score string
     * Returns true if left player (player1) won, false if right player won, null if can't determine
     */
    private calculateWinnerFromScore(score: string): boolean | null {
        try {
            // Parse sets like "6:3, 6:4" or "4:6, 6:3, 7:5"
            const sets = score.split(',').map(s => s.trim());
            let player1Sets = 0;
            let player2Sets = 0;

            for (const set of sets) {
                const match = set.match(/(\d+):(\d+)/);
                if (match) {
                    const p1Games = parseInt(match[1], 10);
                    const p2Games = parseInt(match[2], 10);
                    
                    if (p1Games > p2Games) {
                        player1Sets++;
                    } else if (p2Games > p1Games) {
                        player2Sets++;
                    }
                }
            }

            if (player1Sets > player2Sets) return true;
            if (player2Sets > player1Sets) return false;
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Validate all tournaments for a specific player
     */
    async validatePlayer(playerId: number): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        // Get all tournaments where this player has matches
        const playerTournaments = await db.selectDistinct({ tournamentId: matches.tournamentId })
            .from(matches)
            .where(or(
                eq(matches.player1Id, playerId),
                eq(matches.player2Id, playerId)
            ))
            .all();

        for (const { tournamentId } of playerTournaments) {
            if (tournamentId) {
                const tournamentIssues = await this.validatePlayerTournament(playerId, tournamentId);
                issues.push(...tournamentIssues);
            }
        }

        return issues;
    }

    /**
     * Validate all matches in a specific tournament
     */
    async validateTournament(tournamentId: number): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        // Get all unique players in this tournament
        const tournamentPlayers = await db.select({
            player1Id: matches.player1Id,
            player2Id: matches.player2Id,
        })
            .from(matches)
            .where(eq(matches.tournamentId, tournamentId))
            .all();

        const playerIds = new Set<number>();
        for (const m of tournamentPlayers) {
            if (m.player1Id) playerIds.add(m.player1Id);
            if (m.player2Id) playerIds.add(m.player2Id);
        }

        for (const playerId of Array.from(playerIds)) {
            const playerIssues = await this.validatePlayerTournament(playerId, tournamentId);
            issues.push(...playerIssues);
        }

        return issues;
    }

    /**
     * Find all duplicate matches in the database
     */
    async findDuplicateMatches(): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];

        // Find duplicates based on tournament, round, players, matchType
        const duplicates = await db.all(sql`
            SELECT 
                tournament_id,
                round,
                player1_id,
                player2_id,
                match_type,
                COUNT(*) as count,
                GROUP_CONCAT(id) as match_ids
            FROM matches
            GROUP BY tournament_id, round, player1_id, player2_id, match_type
            HAVING COUNT(*) > 1
        `);

        for (const dup of duplicates as any[]) {
            issues.push({
                type: 'ERROR',
                rule: 'DUPLICATE_MATCH',
                playerId: dup.player1_id,
                tournamentId: dup.tournament_id,
                details: `Duplicate match found: ${dup.count} entries for round ${dup.round}, players ${dup.player1_id} vs ${dup.player2_id}, type ${dup.match_type}`,
                matchIds: dup.match_ids.split(',').map((id: string) => parseInt(id, 10)),
            });
        }

        return issues;
    }

    /**
     * Validate all data in the database
     */
    async validateAll(options?: { 
        playerId?: number, 
        tournamentId?: number,
        limit?: number 
    }): Promise<ValidationReport> {
        const issues: ValidationIssue[] = [];
        const playersChecked = new Set<number>();
        const tournamentsChecked = new Set<number>();

        // Check for duplicate matches first
        const duplicateIssues = await this.findDuplicateMatches();
        issues.push(...duplicateIssues);

        if (options?.playerId) {
            // Validate specific player
            const playerIssues = await this.validatePlayer(options.playerId);
            issues.push(...playerIssues);
            playersChecked.add(options.playerId);
            
            // Track tournaments
            for (const issue of playerIssues) {
                tournamentsChecked.add(issue.tournamentId);
            }
        } else if (options?.tournamentId) {
            // Validate specific tournament
            const tournamentIssues = await this.validateTournament(options.tournamentId);
            issues.push(...tournamentIssues);
            tournamentsChecked.add(options.tournamentId);

            // Track players
            for (const issue of tournamentIssues) {
                playersChecked.add(issue.playerId);
            }
        } else {
            // Validate all (with optional limit)
            const limit = options?.limit || 100;
            
            // Get players with most matches (likely to have issues if there are any)
            const topPlayers = await db.select({
                playerId: matches.player1Id,
                count: sql<number>`COUNT(*)`,
            })
                .from(matches)
                .groupBy(matches.player1Id)
                .orderBy(desc(sql`COUNT(*)`))
                .limit(limit)
                .all();

            for (const { playerId } of topPlayers) {
                if (playerId && !playersChecked.has(playerId)) {
                    const playerIssues = await this.validatePlayer(playerId);
                    issues.push(...playerIssues);
                    playersChecked.add(playerId);

                    for (const issue of playerIssues) {
                        tournamentsChecked.add(issue.tournamentId);
                    }
                }
            }
        }

        // Calculate summary
        const errors = issues.filter(i => i.type === 'ERROR').length;
        const warnings = issues.filter(i => i.type === 'WARNING').length;

        return {
            issues,
            summary: {
                tournamentsChecked: tournamentsChecked.size,
                playersChecked: playersChecked.size,
                errors,
                warnings,
            },
        };
    }

    /**
     * Generate a human-readable report
     */
    generateReport(report: ValidationReport): string {
        const lines: string[] = [];
        
        lines.push('=== DATA INTEGRITY REPORT ===');
        lines.push('');

        if (report.issues.length === 0) {
            lines.push('✅ No issues found!');
        } else {
            // Group by type
            const errors = report.issues.filter(i => i.type === 'ERROR');
            const warnings = report.issues.filter(i => i.type === 'WARNING');

            if (errors.length > 0) {
                lines.push('--- ERRORS ---');
                for (const issue of errors) {
                    lines.push('');
                    lines.push(`❌ ERROR: ${issue.rule}`);
                    lines.push(`   Player: ${issue.playerId} (${issue.playerName || 'Unknown'})`);
                    lines.push(`   Tournament: ${issue.tournamentId} (${issue.tournamentName || 'Unknown'})`);
                    lines.push(`   Details: ${issue.details}`);
                    if (issue.matchIds) {
                        lines.push(`   Match IDs: ${issue.matchIds.join(', ')}`);
                    }
                }
            }

            if (warnings.length > 0) {
                lines.push('');
                lines.push('--- WARNINGS ---');
                for (const issue of warnings) {
                    lines.push('');
                    lines.push(`⚠️ WARNING: ${issue.rule}`);
                    lines.push(`   Player: ${issue.playerId} (${issue.playerName || 'Unknown'})`);
                    lines.push(`   Tournament: ${issue.tournamentId} (${issue.tournamentName || 'Unknown'})`);
                    lines.push(`   Details: ${issue.details}`);
                    if (issue.matchIds) {
                        lines.push(`   Match IDs: ${issue.matchIds.join(', ')}`);
                    }
                }
            }
        }

        lines.push('');
        lines.push('--- SUMMARY ---');
        lines.push(`Tournaments checked: ${report.summary.tournamentsChecked}`);
        lines.push(`Players checked: ${report.summary.playersChecked}`);
        lines.push(`Errors: ${report.summary.errors}`);
        lines.push(`Warnings: ${report.summary.warnings}`);

        return lines.join('\n');
    }
}
