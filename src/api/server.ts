import express from 'express';
import cors from 'cors';
import playersRouter from './routes/players';
import matchesRouter from './routes/matches';
import h2hRouter from './routes/h2h';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/players', playersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/h2h', h2hRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  GET /api/players/search?q=name`);
    console.log(`  GET /api/players/:id`);
    console.log(`  GET /api/matches?playerId=123`);
    console.log(`  GET /api/h2h?player1Id=123&player2Id=456`);
});
