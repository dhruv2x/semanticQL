/**
 * SemanticQL Parser
 *
 * Consumes a token stream produced by the tokenizer and builds a QueryAST.
 * Uses a hand-written, deterministic parser targeting count queries.
 *
 * Grammar (informally):
 *   query ::= "how many" <table> ("with" <column> <value>)?
 */

import type { Token } from "../tokenizer/index";
import type { QueryAST, Filter } from "../ast/types";

export class ParseError extends Error {
    constructor(message: string) {
        super(`[SemanticQL ParseError] ${message}`);
        this.name = "ParseError";
    }
}

/**
 * Current position tracker in the token stream
 */
class TokenStream {
    private pos = 0;

    constructor(private readonly tokens: Token[]) { }

    // Looks without moving the position
    peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    // Moves the position and returns the token
    consume(): Token {
        const t = this.tokens[this.pos];
        if (!t) throw new ParseError("Unexpected end of input");
        this.pos++;
        return t;
    }

    // Make sure next token is what I expect, throw otherwise
    expect(type: Token["type"], value?: string): Token {
        const t = this.consume();
        if (t.type !== type) {
            throw new ParseError(
                `Expected token type "${type}"${value ? ` with value "${value}"` : ""}, got "${t.type}" ("${t.value}")`
            );
        }
        if (value !== undefined && t.value !== value) {
            throw new ParseError(`Expected "${value}", got "${t.value}"`);
        }
        return t;
    }

    isEnd(): boolean {
        return this.pos >= this.tokens.length;
    }
}

/**
 * Main parser entry point.
 * @param {Token[]} tokens a token stream to parse
 * @returns {QueryAST} the AST
 */
export function parse(tokens: Token[]): QueryAST {
    const ts = new TokenStream(tokens);

    const first = ts.peek();
    if (!first) {
        throw new ParseError("Empty query");
    }

    ts.expect("KEYWORD", "how many");
    const tableToken = ts.expect("WORD");
    const table = tableToken.value;

    const filters: Filter[] = [];

    if (!ts.isEnd()) {
        ts.expect("KEYWORD", "with");
        const columnToken = ts.expect("WORD");
        
        const valueToken = ts.consume();
        if (valueToken.type !== "WORD" && valueToken.type !== "NUMBER") {
            throw new ParseError(`Expected a value (WORD or NUMBER) after column, got "${valueToken.type}" ("${valueToken.value}")`);
        }

        const value = valueToken.type === "NUMBER" ? parseFloat(valueToken.value) : valueToken.value;

        filters.push({
            column: columnToken.value,
            operator: "=",
            value,
        });
    }

    if (!ts.isEnd()) {
        const next = ts.peek();
        throw new ParseError(`Unexpected trailing token: "${next?.value}"`);
    }
    /*
        Example:
        {
            "type": "count",
            "table": "sale_order",
            "filters": [
                {
                "column": "state",
                "operator": "=",
                "value": "sale"
                }
            ]
        }

    */

    return {
        type: "count",
        table,
        filters,
    };
}
