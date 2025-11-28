import { Router } from 'express';
import { PlayerRepository } from '../../database/repositories/player.repo';
import { MatchRepository } from '../../database/repositories/match.repo';

const router = Router();
const playerRepo = new PlayerRepository();
const matchRepo = new MatchRepository();

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

// GET /api/players/:id/seasons
router.get('/:id/seasons', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const matchType = (req.query.type as string) || 'all';

        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        const seasons = await playerRepo.getSeasons(
            id,
            matchType as 'all' | 'singles' | 'doubles'
        );

        res.json({ seasons });
    } catch (error: any) {
        console.error('Error getting player seasons:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/players/:id/matches
router.get('/:id/matches', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const seasonsParam = req.query.seasons as string;
        const matchType = (req.query.type as string) || 'all';
        const pageSeason = req.query.season as string | undefined;

        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        // Parse seasons parameter (comma-separated)
        const seasons = seasonsParam ? seasonsParam.split(',').filter(s => s.trim()) : undefined;

        // Get available seasons based on filters
        const availableSeasons = await matchRepo.getAvailableSeasons(id, {
            seasons,
            matchType: matchType as 'all' | 'singles' | 'doubles',
        });

        // Determine which season to display
        let displayedSeason: string;
        if (pageSeason && availableSeasons.includes(pageSeason)) {
            displayedSeason = pageSeason;
        } else if (availableSeasons.length > 0) {
            displayedSeason = availableSeasons[0]; // Most recent season
        } else {
            // No matches found
            return res.json({
                matches: [],
                displayedSeason: null,
                pagination: {
                    availableSeasons: [],
                    currentIndex: -1,
                    hasPrev: false,
                    hasNext: false,
                },
                stats: {
                    totalMatches: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    recentForm: [],
                }
            });
        }

        // Get matches for displayed season
        const matches = await matchRepo.findByPlayerIdWithSeasonFilters(id, {
            seasons,
            matchType: matchType as 'all' | 'singles' | 'doubles',
            pageSeason: displayedSeason,
        });

        // Get stats for ALL filtered matches (not just displayed season)
        const stats = await playerRepo.getFilteredStats(id, {
            seasons,
            matchType: matchType as 'all' | 'singles' | 'doubles',
        });

        // Build pagination info
        const currentIndex = availableSeasons.indexOf(displayedSeason);
        const pagination = {
            availableSeasons,
            currentIndex,
            hasPrev: currentIndex < availableSeasons.length - 1,
            hasNext: currentIndex > 0,
        };

        res.json({
            matches,
            displayedSeason,
            pagination,
            stats,
        });
    } catch (error: any) {
        console.error('Error getting player matches:', error);
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
