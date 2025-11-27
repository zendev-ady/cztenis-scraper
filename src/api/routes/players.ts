import { Router } from 'express';
import { PlayerRepository } from '../../database/repositories/player.repo';

const router = Router();
const playerRepo = new PlayerRepository();

// GET /api/players/search?q=name&limit=10
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        const limit = parseInt(req.query.limit as string) || 10;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const players = await playerRepo.search(query, limit);
        res.json({ players });
    } catch (error: any) {
        console.error('Error searching players:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        const result = await playerRepo.getWithStats(id);

        if (!result) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json(result);
    } catch (error: any) {
        console.error('Error getting player:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
