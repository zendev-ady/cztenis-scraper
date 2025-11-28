# CZTenis Scraper

A TypeScript-based web scraper for Czech tennis data from cztenis.cz. This project scrapes player information, match results, tournament data, and maintains head-to-head statistics in a SQLite database.

## Features

- Web scraping of player profiles and match history from cztenis.cz
- Queue-based scraping system with retry logic
- SQLite database with Drizzle ORM for data persistence
- Head-to-head (H2H) statistics calculation
- Tournament and match data extraction
- Player rankings tracking
- CLI interface for scraping operations and database verification

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Install browser binaries for Playwright
npx playwright install
```

### 2. Database Setup

Initialize the SQLite database:

```bash
npm run db:push
```

### 3. Run

You can run the scraper or the API server.

**Start the API Server:**

Start the API server to provide data to the web frontend:

```bash
npm start
# or
npm run api
# Server runs at http://localhost:3001
```

**Start Scraping:**
```bash
# Scrape a specific player (ID 1026900), depth 1 (opponents), max 10 players
npm run scrape start 1026900 1 10
```

## Scraper

Scrape data from cztenis.cz and store it in the database:

```bash
npm run scrape start <playerId> <maxDepth> <limit>
```

| Argument | Description | Default |
|----------|-------------|---------|
| `playerId` | ID from cztenis.cz URL (e.g., `1026900`) | Required for new scrape |
| `maxDepth` | `0`=Player only, `1`=Opponents, `-1`=Unlimited | `-1` |
| `limit` | Max players to process (`-1` = unlimited) | `-1` |



### Common Commands

```bash
# Check Queue Status
npm run queue-status

# Retry Failed Items
npm run scrape reset-queue

# Clear Queue (use before new scrape)
npm run scrape clear-queue
```

## Database Management

### Verify Data
Check what's currently in your database:

```bash
npx tsx src/cli/verify-db.ts
```

### Reset Database
**WARNING:** This deletes ALL data!
1. Deletes the database file (`data/cztenis.db`)
2. Recreates the schema automatically
3. Leaves you with a clean, empty database

```bash
# Clear DB and recreate schema
npm run scrape clear-db -- --force

# Or use tsx directly
npx tsx src/cli/scrape.ts clear-db --force
```

## Database Schema

The application uses the following main tables:

- **players**: Player information including name, club, and registration details
- **matches**: Match results with scores, participants, and tournament information
- **tournaments**: Tournament details including venue, date, and category
- **seasons**: Season definitions and time periods
- **h2h_stats**: Calculated head-to-head statistics between players
- **player_rankings**: Player rankings across different categories and seasons
- **scrape_queue**: Queue management for scraping operations

## Technologies Used

- **TypeScript**: Type-safe JavaScript development
- **Node.js**: Runtime environment
- **Drizzle ORM**: Type-safe SQL toolkit for TypeScript
- **SQLite**: Lightweight database for data storage
- **Playwright**: Browser automation for web scraping
- **Cheerio**: Server-side HTML parsing
- **Commander.js**: CLI framework for Node.js
- **Winston**: Logging library
- **p-queue**: Promise queue with concurrency control

## Configuration

The application can be configured through environment variables:

- `LOG_LEVEL`: Set logging level (default: 'info')

Other configuration options are available in `src/config.ts`:
- Scraping delay and retry settings
- Database path
- Base URL for scraping
- User agent string

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/players/search?q=...` | Search players by name |
| `GET` | `/api/players/:id` | Get full player profile |
| `GET` | `/api/matches?playerId=...` | Get match history |
| `GET` | `/api/h2h?player1Id=...` | Get H2H stats between two players |