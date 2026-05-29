/**
 * SemanticQL Normalizer
 *
 * A pre-processing layer that sits between raw user input and the tokenizer.
 * Responsibilities (in order):
 *
 *   1. Raw SQL detection  — if the user passes the `-r` flag (anywhere at the
 *      start or end of the input) the query is treated as literal SQL and the
 *      rest of the pipeline is bypassed entirely.
 *
 *   2. Trailing semicolon removal — users sometimes add a `;` at the end of a
 *      natural-language query by habit.  Strip it so the tokenizer never sees it.
 *      (Semicolons inside a raw-SQL query are intentional and are preserved.)
 *
 *   3. Filler word removal — common filler words ("hey", "me", "is", "please",
 *      "all") that appear immediately after a top-level query keyword are
 *      meaningless syntactically.  They are removed before tokenization so the
 *      parser always receives a clean token stream.
 *
 *      IMPORTANT: filler words are only stripped right after the opening
 *      top-level keyword (show, list, give, fetch, get, how many, count,
 *      sum, avg, etc.).
 *      Filler words that appear inside filter expressions are left untouched
 *      because they may be legitimate column values.
 */

import { AGGREGATE_KEYWORDS } from "../language/index.js";

export interface NormalizeResult {
    isRaw: boolean;
    rawSql?: string;
    query?: string;
}

const FILLER_WORDS: ReadonlySet<string> = new Set([
    "hey",
    "me",
    "is",
    "please",
    "all",
]);

const TOP_LEVEL_KEYWORDS: readonly string[] = [
    ...AGGREGATE_KEYWORDS,
    "show",
    "find",
    "list",
    "give",
    "fetch",
    "get",
    "top",
    "latest",
    "oldest",
];

function stripFillerWords(input: string): string {
    const lowerInput = input.toLowerCase();
    
    let matchedKeyword: string | null = null;
    let keywordIndex = -1;

    for (const kw of TOP_LEVEL_KEYWORDS) {
        const index = lowerInput.indexOf(kw);
        
        if (index !== -1) {
            const charAfter = lowerInput[index + kw.length];
            const isWordBoundaryAfter = charAfter === undefined || /^\s/.test(charAfter);
            const isWordBoundaryBefore = index === 0 || /^\s/.test(lowerInput[index - 1]);

            if (isWordBoundaryBefore && isWordBoundaryAfter) {
                // Track the earliest matching top-level keyword position
                if (keywordIndex === -1 || index < keywordIndex) {
                    keywordIndex = index;
                    matchedKeyword = kw;
                }
            }
        }
    }

    if (keywordIndex === -1 || !matchedKeyword) {
        return input.trim();
    }

    const normalizedPart = input.slice(keywordIndex);
    const kwOriginal = normalizedPart.slice(0, matchedKeyword.length);
    const rest = normalizedPart.slice(matchedKeyword.length).trimStart();
    if (!rest) return kwOriginal;

    const words = rest.split(/\s+/);
    let i = 0;
    while (i < words.length && FILLER_WORDS.has(words[i]!.toLowerCase())) {
        i++;
    }

    const cleanedRest = words.slice(i).join(" ");
    return cleanedRest ? `${kwOriginal} ${cleanedRest}` : kwOriginal;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalise raw user input.
 *
 * @param rawInput  The exact string the user typed at the REPL prompt.
 * @returns         A NormalizeResult describing how to proceed.
 */
export function normalize(rawInput: string): NormalizeResult {
    let input = rawInput.trim();

    // ------------------------------------------------------------------
    // 1. Raw SQL detection
    //    Accepted forms:
    //      -r SELECT * FROM users;
    //      SELECT * FROM users; -r
    // ------------------------------------------------------------------

    const RAW_FLAG = "-r";

    if (input.startsWith(RAW_FLAG + " ") || input === RAW_FLAG) {
        const sql = input.slice(RAW_FLAG.length).trim();
        return { isRaw: true, rawSql: sql };
    }

    if (input.endsWith(" " + RAW_FLAG)) {
        const sql = input.slice(0, input.length - (RAW_FLAG.length + 1)).trim();
        return { isRaw: true, rawSql: sql };
    }

    if (input.endsWith(";")) {
        input = input.slice(0, -1).trimEnd();
    }

    input = stripFillerWords(input);

    return { isRaw: false, query: input };
}
