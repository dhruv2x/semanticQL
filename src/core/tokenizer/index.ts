/**
 * SemanticQL Tokenizer
 *
 * Scans a simplified English query string and segments it into a list of
 * typed tokens (KEYWORD, WORD, NUMBER). This simplifies the parsing stage
 * by handling raw string matching, whitespace removal, and keyword classification.
 */


export type TokenType = "KEYWORD" | "WORD" | "NUMBER";

export interface Token {
    type: TokenType;
    value: string;
}

/**
 * Known keywords that have syntactic significance in our grammar.
 */
const KEYWORDS: string[] = [
    "how many",
    "count",

    "with",
    "where",
    
    "and",
    "or",

    "more than",
    "greater than",
    "higher than",
    "above",
    "over",

    "less than",
    "lower than",
    "below",
    "under",

    "at least",
    "minimum",
    "no less than",
    "greater than or equal to",

    "at most",
    "maximum",
    "no more than",
    "less than or equal to",

    "equal to",
    "equals",
    "exactly",
    "same as",
].sort((a, b) => b.length - a.length);

/**
 * Tokenize a natural-language query string.
 *
 * Steps:
 *  1. Normalise whitespace.
 *  2. Walk through the string trying to match keywords case-insensitively first.
 *  3. Preserve case for WORD and NUMBER tokens.
 *  4. Emit a Token for each match.
 */
export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let text = input.replace(/\s+/g, " ").trim();

    while (text.length > 0) {
        text = text.trimStart();
        if (text.length === 0) break;

        let matched = false;

        for (const kw of KEYWORDS) {
            const kwLen = kw.length;
            const sub = text.slice(0, kwLen).toLowerCase();
            if (sub === kw) {
                const nextChar = text[kwLen];
                if (nextChar === undefined || !/^[a-zA-Z0-9_]$/.test(nextChar)) {
                    tokens.push({ type: "KEYWORD", value: kw });
                    text = text.slice(kwLen);
                    matched = true;
                    break;
                }
            }
        }
        if (matched) continue;

        const numMatch = /^(\d+(?:\.\d+)?)/.exec(text);
        if (numMatch && numMatch[1]) {
            tokens.push({ type: "NUMBER", value: numMatch[1] });
            text = text.slice(numMatch[1].length);
            continue;
        }

        const wordMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)/.exec(text);
        if (wordMatch && wordMatch[1]) {
            tokens.push({ type: "WORD", value: wordMatch[1] });
            text = text.slice(wordMatch[1].length);
            continue;
        }

        text = text.slice(1);
    }

    return tokens;
}
