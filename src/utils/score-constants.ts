// Shared constants for score parsing and validation

// Walkover/retirement markers seen on cztenis
export const WALKOVER_PATTERNS = ['scr', 'scr.', 'w.o.', 'def.', 'ret.', 'skreč'];

// Regex for a single set like "6:3" or with tiebreak "7:6 (5)" or super tiebreak "1:0 (10)"
export const SET_PATTERN = /^(\d+):(\d+)(?:\s*\((\d*)\))?$/;
