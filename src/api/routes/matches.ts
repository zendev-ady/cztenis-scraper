import { Router } from 'express';
import { MatchRepository } from '../../database/repositories/match.repo';

const router = Router();
const matchRepo = new MatchRepository();

// GET /api/matches?playerId=123&limit=50&offset=0&matchType=singles&year=2024
router.get('/', async (req, res) => {
    try {
        const playerId = parseInt(req.query.playerId as string);
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const matchType = req.query.matchType as 'singles' | 'doubles' | undefined;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;

        if (isNaN(playerId)) {
            return res.status(400).json({ error: 'Query parameter "playerId" is required' });
        }

        const [matchesData, total] = await Promise.all([
            matchRepo.findByPlayerId(playerId, { limit, offset, matchType, year }),
            matchRepo.countByPlayerId(playerId)
        ]);

        res.json({ matches: matchesData, total });
    } catch (error: any) {
        console.error('Error getting matches:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
