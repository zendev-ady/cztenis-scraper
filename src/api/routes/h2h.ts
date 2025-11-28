import { Router } from 'express';
import { PlayerRepository } from '../../database/repositories/player.repo';
import { MatchRepository } from '../../database/repositories/match.repo';

const router = Router();
const playerRepo = new PlayerRepository();
const matchRepo = new MatchRepository();

// GET /api/h2h?player1Id=123&player2Id=456&matchType=singles|doubles|all
router.get('/', async (req, res) => {
    try {
        const player1Id = parseInt(req.query.player1Id as string);
        const player2Id = parseInt(req.query.player2Id as string);
        const matchType = (req.query.matchType as 'all' | 'singles' | 'doubles') || 'all';

        if (isNaN(player1Id) || isNaN(player2Id)) {
            return res.status(400).json({ error: 'Query parameters "player1Id" and "player2Id" are required' });
        }

        // Get both players
        const [player1, player2] = await Promise.all([
            playerRepo.findById(player1Id),
            playerRepo.findById(player2Id)
        ]);

        if (!player1 || !player2) {
            return res.status(404).json({ error: 'One or both players not found' });
        }

        // Get matches between players with tournament data
        const matchesWithTournaments = await matchRepo.findBetweenPlayers(player1Id, player2Id, { matchType });

        // Calculate H2H stats based on filtered matches
        const stats = {
            totalMatches: matchesWithTournaments.length,
            player1Wins: matchesWithTournaments.filter(m => m.match.winnerId === player1Id).length,
            player2Wins: matchesWithTournaments.filter(m => m.match.winnerId === player2Id).length,
            lastMatchDate: matchesWithTournaments[0]?.match.matchDate || null,
            firstMatchDate: matchesWithTournaments[matchesWithTournaments.length - 1]?.match.matchDate || null
        };

        res.json({
            player1,
            player2,
            stats,
            matches: matchesWithTournaments
        });
    } catch (error: any) {
        console.error('Error getting H2H:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
