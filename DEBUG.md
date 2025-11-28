# Debugging & Data Quality Tools

Nástroje pro validaci dat, hledání problémů a čištění databáze.

## Quick Reference

```bash
# Validace integrity dat
npm run validate-integrity

# Cleanup duplicit (dry run)
npm run cleanup-duplicates

# Status fronty scraperu
npm run queue-status

# Ověření databáze
npx tsx src/cli/verify-db.ts
```

---

## 1. Validate Integrity

Kontroluje logickou konzistenci dat v databázi - validuje turnajová pravidla pro každého hráče.

### Použití

```bash
# Validovat top 100 hráčů (podle počtu zápasů)
npm run validate-integrity

# Validovat konkrétního hráče
npm run validate-integrity -- --player 1026900

# Validovat konkrétní turnaj
npm run validate-integrity -- --tournament 123456

# Omezit počet kontrolovaných hráčů
npm run validate-integrity -- --limit 50

# JSON výstup (pro další zpracování)
npm run validate-integrity -- --json
```

### Validační pravidla

| Pravidlo | Typ | Popis |
|----------|-----|-------|
| `RULE_1_ONE_MATCH_PER_ROUND` | WARNING | Hráč má více zápasů ve stejném kole turnaje |
| `RULE_2_WINNER_CONTINUITY` | WARNING | Hráč vyhrál v kole N, ale nemá zápas v kole N+1 |
| `RULE_3_NO_MATCH_AFTER_LOSS` | ERROR | Hráč má zápas po prohře (logicky nemožné) |
| `RULE_4_SCORE_CONSISTENCY` | WARNING | Skóre neodpovídá určenému vítězi |
| `DUPLICATE_MATCH` | ERROR | Duplicitní záznam zápasu v databázi |

### Příklad výstupu

```
=== DATA INTEGRITY REPORT ===

--- ERRORS ---

❌ ERROR: RULE_3_NO_MATCH_AFTER_LOSS
   Player: 1026900 (Baum Štěpán)
   Tournament: 123456 (A4 OPTIM TOUR)
   Details: Player has match in round 4>2 after losing in round 8>4
   Match IDs: 789

--- WARNINGS ---

⚠️ WARNING: RULE_1_ONE_MATCH_PER_ROUND
   Player: 1026900 (Baum Štěpán)
   Tournament: 123456 (A4 OPTIM TOUR)
   Details: Multiple matches in round 32>16 (found 2, expected max 1)
   Match IDs: 123, 456

--- SUMMARY ---
Tournaments checked: 150
Players checked: 45
Errors: 3
Warnings: 12
```

---

## 2. Cleanup Duplicates

Najde a odstraní duplicitní/neplatné záznamy v databázi.

### Použití

```bash
# Dry run - ukáže co by se smazalo (BEZ změn)
npm run cleanup-duplicates

# Skutečně smazat nalezené problémy
npm run cleanup-duplicates -- --execute

# Analyzovat konkrétního hráče v turnaji
npm run cleanup-duplicates -- --analyze-player 1026900 --analyze-tournament 123456
```

### Co kontroluje

1. **Duplicitní zápasy** - stejný zápas uložen vícekrát
2. **Orphaned matches** - zápasy s neexistujícími hráči
3. **Invalid matches** - zápasy kde je stejný hráč na obou stranách, NULL player IDs

### Příklad výstupu

```
🧹 Cleanup Duplicates Tool

⚠️ DRY RUN MODE - No changes will be made

🔍 Finding duplicate matches...

📋 Duplicate group: Tournament 123456, Round 32>16
   Players: 1026900 vs 1027000 (singles)
   Found 2 duplicates, keeping ID 100, deleting: 101

=== SUMMARY ===
Duplicate groups: 1
Orphaned matches: 0
Invalid matches: 0

💡 To apply changes, run with --execute flag
```

---

## 3. Scrape s validací

Automaticky spustí validaci po dokončení scrapingu.

```bash
# Scrape konkrétního hráče s validací na konci
npm run scrape start 1026900 --validate

# Nebo pomocí shortcut
npm run scrape:validate 1026900
```

---

## 4. Analýza konkrétního případu

Když najdeš podezřelá data, můžeš je analyzovat detailně:

```bash
# 1. Zjisti zápasy hráče v konkrétním turnaji
npm run cleanup-duplicates -- --analyze-player 1026900 --analyze-tournament 123456

# 2. Validuj jen tohoto hráče
npm run validate-integrity -- --player 1026900

# 3. Podívej se na data přímo v DB
npx tsx -e "
const {db} = require('./src/database');
const {matches} = require('./src/database/schema');
const {eq, and, or} = require('drizzle-orm');

const playerId = 1026900;
const tournamentId = 123456;

const results = db.select().from(matches).where(
  and(
    eq(matches.tournamentId, tournamentId),
    or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId))
  )
).all();

console.table(results.map(m => ({
  id: m.id,
  round: m.round,
  p1: m.player1Id,
  p2: m.player2Id,
  winner: m.winnerId,
  score: m.score
})));
"
```

---

## 5. Databázové nástroje

### Verify DB

```bash
npx tsx src/cli/verify-db.ts
```

Zobrazí statistiky databáze - počet hráčů, zápasů, turnajů.

### Queue Status

```bash
npm run queue-status
```

Zobrazí stav scraping fronty - pending, processing, completed, failed.

### Reset fronty

```bash
# Reset failed items na pending
npm run scrape reset-queue

# Vymazat celou frontu
npm run scrape clear-queue
```

### Smazat celou DB a začít znovu

```bash
npm run scrape clear-db -- --force
```

⚠️ **POZOR**: Smaže všechna data!

---

## Časté problémy a řešení

### Problém: Hráč má duplicitní zápasy v turnaji

**Symptom**: `RULE_1_ONE_MATCH_PER_ROUND` warning

**Příčina**: Pravděpodobně bug v parseru nebo duplicitní scraping

**Řešení**:
```bash
# 1. Analyzuj situaci
npm run cleanup-duplicates -- --analyze-player <ID> --analyze-tournament <ID>

# 2. Smaž duplicity
npm run cleanup-duplicates -- --execute
```

### Problém: Zápas po prohře

**Symptom**: `RULE_3_NO_MATCH_AFTER_LOSS` error

**Příčina**: Špatně přiřazený zápas jinému hráči, nebo špatně určený vítěz

**Řešení**: Manuálně zkontrolovat data na cztenis.cz a případně smazat špatné záznamy

### Problém: Skóre neodpovídá vítězi

**Symptom**: `RULE_4_SCORE_CONSISTENCY` warning

**Příčina**: Bug v `determineWinnerFromScore()` nebo neobvyklý formát skóre

**Řešení**: Zkontrolovat konkrétní zápas a případně opravit parser

---

## Unique Constraints

Databáze má nastavené unique constraints pro prevenci duplicit:

| Tabulka | Unique Key |
|---------|------------|
| `players` | `id` (primary key) |
| `matches` | `(tournament_id, round, player1_id, player2_id, match_type)` |
| `h2h_stats` | `(player1_id, player2_id)` |
| `player_rankings` | `(player_id, season_code)` |
| `scrape_queue` | `player_id` |
| `seasons` | `code` |

---

## Logy

Všechny logy jsou v `logs/` adresáři:
- `logs/combined.log` - všechny logy
- `logs/error.log` - pouze chyby

Pro verbose logování nastav v `.env`:
```
LOG_LEVEL=debug
```
