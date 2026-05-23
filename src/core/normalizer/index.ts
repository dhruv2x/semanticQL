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
 *      top-level keyword (show, list, give, fetch, get, how many, count).
 *      Filler words that appear inside filter expressions are left untouched
 *      because they may be legitimate column values.
 */

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
    "how many",
    "count",
    "show",
    "list",
    "give",
    "fetch",
    "get",
];

function stripFillerWords(input: string): string {
    const lower = input.toLowerCase();

    for (const kw of TOP_LEVEL_KEYWORDS) {
        if (!lower.startsWith(kw)) continue;

        // Make sure the keyword is followed by whitespace (not part of a longer word).
        const afterKw = lower.slice(kw.length);
        if (afterKw.length > 0 && !/^\s/.test(afterKw)) continue;

        // The original casing of the keyword part.
        const kwOriginal = input.slice(0, kw.length);

        // The rest of the string after the keyword, split by whitespace.
        const rest = input.slice(kw.length).trimStart();
        const words = rest.split(/\s+/);

        // Strip leading filler words.
        let i = 0;
        while (i < words.length && FILLER_WORDS.has(words[i]!.toLowerCase())) {
            i++;
        }

        const cleaned = words.slice(i).join(" ");
        return cleaned ? `${kwOriginal} ${cleaned}` : kwOriginal;
    }

    // No top-level keyword matched — return unchanged.
    return input;
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

    // Flag at the very beginning
    if (input.startsWith(RAW_FLAG + " ") || input === RAW_FLAG) {
        const sql = input.slice(RAW_FLAG.length).trim();
        return { isRaw: true, rawSql: sql };
    }

    // Flag at the very end
    if (input.endsWith(" " + RAW_FLAG)) {
        const sql = input.slice(0, input.length - (RAW_FLAG.length + 1)).trim();
        return { isRaw: true, rawSql: sql };
    }

    // ------------------------------------------------------------------
    // 2. Trailing semicolon removal (natural-language queries only)
    // ------------------------------------------------------------------

    if (input.endsWith(";")) {
        input = input.slice(0, -1).trimEnd();
    }

    // ------------------------------------------------------------------
    // 3. Filler word removal (after top-level keywords only)
    // ------------------------------------------------------------------

    input = stripFillerWords(input);

    return { isRaw: false, query: input };
}
