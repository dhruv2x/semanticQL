/**
 * SemanticQL Parser
 *
 * Consumes a token stream produced by the tokenizer and builds a QueryAST.
 * Uses a modular, extensible architecture designed to support future query types.
 */

import type { Token } from "../tokenizer/index";
import { AGGREGATE_FUNCTIONS } from "../language/index";
import type { QueryAST, Operator, Condition } from "../ast/types";

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

    // Looks at an offset without moving the position
    peekAhead(offset: number): Token | undefined {
        return this.tokens[this.pos + offset];
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

const COMPARISON_OPERATORS: Record<string, Operator> = {
    // Greater than
    "more than": ">",
    "greater than": ">",
    "higher than": ">",
    "above": ">",
    "over": ">",

    // Less than
    "less than": "<",
    "lower than": "<",
    "below": "<",
    "under": "<",

    // At least
    "at least": ">=",
    "minimum": ">=",
    "no less than": ">=",
    "greater than or equal to": ">=",

    // At most
    "at most": "<=",
    "maximum": "<=",
    "no more than": "<=",
    "less than or equal to": "<=",

    // Equal to
    "equal to": "=",
    "equals": "=",
    "exactly": "=",
    "same as": "=",
    "is": "=",
};

/**
 * Scalable parser interface.
 * Allows adding other query types in the future.
 */
interface QueryParser {
    supports(ts: TokenStream): boolean;
    parse(ts: TokenStream): QueryAST;
}

/**
 * Parse one or more filters separated by "and" and "or" starting with "with" or "where".
 */
function parseFilters(ts: TokenStream): Condition | undefined {
    if (ts.isEnd()) {
        return undefined;
    }

    const next = ts.peek();
    if (!next || next.type !== "KEYWORD" || (next.value !== "with" && next.value !== "where")) {
        return undefined;
    }

    ts.consume(); // Consume "with" or "where"

    return parseExpression(ts);
}

function parseExpression(ts: TokenStream): Condition {
    let node = parseTerm(ts);

    while (true) {
        const next = ts.peek();
        if (next && next.type === "KEYWORD" && next.value === "or") {
            ts.consume(); // consume 'or'
            const right = parseTerm(ts);
            node = {
                type: "logical",
                operator: "or",
                left: node,
                right: right,
            };
        } else {
            break;
        }
    }

    return node;
}

function parseTerm(ts: TokenStream): Condition {
    let node = parseFactor(ts);

    while (true) {
        const next = ts.peek();
        if (next && next.type === "KEYWORD" && next.value === "and") {
            ts.consume(); // consume 'and'
            const right = parseFactor(ts);
            node = {
                type: "logical",
                operator: "and",
                left: node,
                right: right,
            };
        } else {
            break;
        }
    }

    return node;
}

function parseFactor(ts: TokenStream): Condition {
    const columnToken = ts.expect("WORD");
    const column = columnToken.value;

    let operator: Operator = "=";

    // Peek next token to see if it's a known comparison operator keyword
    const nextToken = ts.peek();
    if (nextToken && nextToken.type === "KEYWORD" && nextToken.value in COMPARISON_OPERATORS) {
        const opToken = ts.consume();
        operator = COMPARISON_OPERATORS[opToken.value];
    }

    const valueToken = ts.consume();
    if (valueToken.type !== "WORD" && valueToken.type !== "NUMBER") {
        throw new ParseError(
            `Expected a value (WORD or NUMBER) after column "${column}", got "${valueToken.type}" ("${valueToken.value}")`
        );
    }

    const value = valueToken.type === "NUMBER" ? parseFloat(valueToken.value) : valueToken.value;

    return {
        type: "filter",
        column,
        operator,
        value,
    };
}

/**
 * Parser for aggregate queries such as:
 * - count users
 * - count from users
 * - sum revenue from sales
 * - average salary from employees
 */
class AggregateQueryParser implements QueryParser {
    supports(ts: TokenStream): boolean {
        const next = ts.peek();
        return next !== undefined && next.type === "KEYWORD" && next.value in AGGREGATE_FUNCTIONS;
    }

    parse(ts: TokenStream): QueryAST {
        const start = ts.consume();
        if (start.type !== "KEYWORD" || !(start.value in AGGREGATE_FUNCTIONS)) {
            throw new ParseError(`Expected aggregate keyword, got "${start.value}"`);
        }

        const aggregateFunction = AGGREGATE_FUNCTIONS[start.value];
        let table = "";
        let column: string | undefined;

        const next = ts.peek();
        if (next?.type === "KEYWORD" && next.value === "from") {
            ts.consume();
            const tableToken = ts.expect("WORD");
            table = tableToken.value;
        } else {
            const wordToken = ts.expect("WORD");
            const afterWord = ts.peek();

            if (afterWord?.type === "KEYWORD" && afterWord.value === "from") {
                column = wordToken.value;
                ts.consume();
                const tableToken = ts.expect("WORD");
                table = tableToken.value;
            } else if (aggregateFunction === "count") {
                table = wordToken.value;
            } else {
                throw new ParseError(
                    `Expected "from" after aggregate column "${wordToken.value}"`
                );
            }
        }

        const filters = parseFilters(ts);

        return {
            type: "aggregate",
            table,
            aggregate: {
                function: aggregateFunction,
                column,
            },
            filters,
        };
    }
}

/**
 * Parser for select queries starting with "show", "list", "give", "fetch", or "get".
 */
class SelectQueryParser implements QueryParser {
    supports(ts: TokenStream): boolean {
        const next = ts.peek();
        return (
            next !== undefined &&
            next.type === "KEYWORD" &&
            (next.value === "show" ||
                next.value === "list" ||
                next.value === "give" ||
                next.value === "fetch" ||
                next.value === "get")
        );
    }

    parse(ts: TokenStream): QueryAST {
        const start = ts.consume();
        if (
            start.type !== "KEYWORD" ||
            (start.value !== "show" &&
                start.value !== "list" &&
                start.value !== "give" &&
                start.value !== "fetch" &&
                start.value !== "get")
        ) {
            throw new ParseError(
                `Expected select keyword, got "${start.value}"`
            );
        }

        // Scan the remaining tokens to see if there is a 'from' keyword.
        let hasFrom = false;
        let fromOffset = 0;
        while (true) {
            const tok = ts.peekAhead(fromOffset);
            if (!tok) {
                break;
            }
            if (tok.type === "KEYWORD" && tok.value === "from") {
                hasFrom = true;
                break;
            }
            fromOffset++;
        }

        let columns: string[] = ["*"];
        let table = "";

        if (hasFrom) {
            columns = [];
            for (let i = 0; i < fromOffset; i++) {
                const colToken = ts.expect("WORD");
                columns.push(colToken.value);
            }
            ts.expect("KEYWORD", "from");
            const tableToken = ts.expect("WORD");
            table = tableToken.value;
        } else {
            const tableToken = ts.expect("WORD");
            table = tableToken.value;
        }

        const filters = parseFilters(ts);

        return {
            type: "select",
            table,
            columns,
            filters,
        };
    }
}

/**
 * Registered query parsers.
 * Easily extendable by adding more parsers to this array.
 */
const queryParsers: QueryParser[] = [
    new AggregateQueryParser(),
    new SelectQueryParser(),
];

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

    for (const parser of queryParsers) {
        if (parser.supports(ts)) {
            const ast = parser.parse(ts);

            if (!ts.isEnd()) {
                const next = ts.peek();
                throw new ParseError(`Unexpected trailing token: "${next?.value}"`);
            }

            return ast;
        }
    }

    throw new ParseError(`Unsupported query starting with: "${first.value}"`);
}
