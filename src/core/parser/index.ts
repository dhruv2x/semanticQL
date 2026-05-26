/**
 * SemanticQL Parser
 *
 * Converts token streams into AST nodes through small, composable parsers:
 * - query parsers choose the top-level intent
 * - select prefix parsers handle the shape before filters/order/limit
 * - modifier parsers handle trailing clauses independently
 */

import { AGGREGATE_FUNCTIONS } from "../language/index";
import type {
    AggregateFunction,
    AggregateQueryAST,
    Condition,
    Operator,
    QueryAST,
    QueryModifiers,
    SelectQueryAST,
    SortDirection,
} from "../ast/types";
import type { Token } from "../tokenizer/index";

/**
 * Custom error class for parser-specific exceptions.
 * Helps distinguish parsing syntax errors from internal system errors.
 */
export class ParseError extends Error {
    constructor(message: string) {
        super(`[SemanticQL ParseError] ${message}`);
        this.name = "ParseError";
    }
}

/**
 * Manages the sequential consumption of tokens.
 * Provides utility methods for lookahead, validation, and state restoration (backtracking).
 */
class TokenStream {
    private pos = 0;

    constructor(private readonly tokens: Token[]) {}

    /**
     * Looks at a token at a specific offset without consuming it.
     * * @param offset Number of positions ahead to look (defaults to 0, the current token).
     * @returns The token at the requested position, or undefined if out of bounds.
     */
    peek(offset = 0): Token | undefined {
        return this.tokens[this.pos + offset];
    }

    /**
     * Retrieves the current token and advances the cursor.
     * * @throws {ParseError} If there are no more tokens left to consume.
     * @returns The consumed token.
     */
    consume(): Token {
        const token = this.tokens[this.pos];
        if (!token) {
            throw new ParseError("Unexpected end of input");
        }

        this.pos++;
        return token;
    }

    /**
     * Asserts that the current token matches an expected type (and optionally, value).
     * Consumes the token if successful.
     * * @param type The expected TokenType.
     * @param value The expected string value (optional).
     * @throws {ParseError} If the token doesn't match the expected criteria.
     * @returns The validated and consumed token.
     */
    expect(type: Token["type"], value?: string): Token {
        const token = this.consume();

        if (token.type !== type) {
            throw new ParseError(
                `Expected token type "${type}"${value ? ` with value "${value}"` : ""}, got "${token.type}" ("${token.value}")`
            );
        }

        if (value !== undefined && token.value !== value) {
            throw new ParseError(`Expected "${value}", got "${token.value}"`);
        }

        return token;
    }

    /**
     * Checks if the current token matches a specific value.
     * Does NOT consume the token.
     * * @param value The token value to check against.
     * @returns True if it matches, false otherwise.
     */
    match(value: string): boolean {
        return this.peek()?.value === value;
    }

    /**
     * @returns True if all tokens in the stream have been consumed.
     */
    isEnd(): boolean {
        return this.pos >= this.tokens.length;
    }

    /**
     * Saves the current cursor position. Used for backtracking.
     * @returns The current index position.
     */
    snapshot(): number {
        return this.pos;
    }

    /**
     * Restores the cursor to a previously saved position.
     * @param pos The index position to restore to.
     */
    restore(pos: number): void {
        this.pos = pos;
    }
}

/**
 * Shared context passed to all parser implementations.
 */
interface ParserContext {
    ts: TokenStream;
}

/**
 * Interface for top-level query parsers (e.g., Select, Aggregate).
 */
interface QueryParser {
    supports(ctx: ParserContext): boolean;
    parse(ctx: ParserContext): QueryAST;
}

/**
 * Helper to construct a standard Select AST node.
 */
function buildSelectAST(
    table: string,
    columns: string[],
    modifiers: QueryModifiers
): SelectQueryAST {
    return { type: "select", table, columns, modifiers };
}

/**
 * Helper to construct a standard Aggregate AST node.
 */
function buildAggregateAST(
    aggregate: AggregateQueryAST["aggregate"],
    table: string,
    modifiers: QueryModifiers
): AggregateQueryAST {
    return { type: "aggregate", table, aggregate, modifiers };
}

/**
 * Mapping of natural language comparative phrases to standard SQL operators.
 */
const COMPARISON_OPERATORS: Record<string, Operator> = {
    "more than": ">", "greater than": ">", "higher than": ">", "above": ">", "over": ">",
    "less than": "<", "lower than": "<", "below": "<", "under": "<",
    "at least": ">=", "minimum": ">=", "no less than": ">=", "greater than or equal to": ">=",
    "at most": "<=", "maximum": "<=", "no more than": "<=", "less than or equal to": "<=",
    "equal to": "=", "equals": "=", "exactly": "=", "same as": "=", "is": "=",
};

/**
 * Mapping of natural language text-match phrases to semantic operators.
 * SQL-specific wildcard placement is handled by the SQL builder.
 */
const TEXT_MATCH_OPERATORS: Record<string, Operator> = {
    "like": "like",
    "contains": "contains",
    "containing": "contains",
    "starts with": "startsWith",
    "startswith": "startsWith",
    "ends with": "endsWith",
    "endswith": "endsWith",
};

const FILTER_OPERATORS: Record<string, Operator> = {
    ...COMPARISON_OPERATORS,
    ...TEXT_MATCH_OPERATORS,
};

/**
 * Recursive descent parser for logical OR expressions.
 * Lowest precedence in logical operations.
 */
function parseExpression(ts: TokenStream): Condition {
    let node = parseTerm(ts);

    // Keep wrapping left-side conditions as long as we encounter 'or'
    while (ts.match("or")) {
        ts.consume();
        node = {
            type: "logical",
            operator: "or",
            left: node,
            right: parseTerm(ts), // Descend into ANDs/factors to maintain precedence
        };
    }

    return node;
}

/**
 * Recursive descent parser for logical AND expressions.
 * Higher precedence than OR.
 */
function parseTerm(ts: TokenStream): Condition {
    let node = parseFactor(ts);

    // Keep wrapping left-side conditions as long as we encounter 'and'
    while (ts.match("and")) {
        ts.consume();
        node = {
            type: "logical",
            operator: "and",
            left: node,
            right: parseFactor(ts),
        };
    }

    return node;
}

/**
 * Parses the base condition component: "column [operator] value".
 * Example: "age greater than 18" -> { column: 'age', operator: '>', value: 18 }
 */
function parseFactor(ts: TokenStream): Condition {
    // 1. Column name
    const column = ts.expect("WORD").value;
    
    // 2. Operator (defaults to '=' if not explicitly provided)
    let operator: Operator = "=";
    const nextToken = ts.peek();
    if (nextToken?.type === "KEYWORD" && nextToken.value in FILTER_OPERATORS) {
        operator = FILTER_OPERATORS[ts.consume().value];
    }

    // 3. Value
    const valueToken = ts.consume();
    if (valueToken.type !== "WORD" && valueToken.type !== "NUMBER") {
        throw new ParseError(
            `Expected a value (WORD or NUMBER) after column "${column}", got "${valueToken.type}" ("${valueToken.value}")`
        );
    }

    return {
        type: "filter",
        column,
        operator,
        // Convert NUMBER tokens to actual JavaScript floats
        value: valueToken.type === "NUMBER" ? parseFloat(valueToken.value) : valueToken.value,
    };
}

/**
 * Interface for parsing trailing query clauses (WHERE, ORDER BY, LIMIT).
 */
interface ModifierParser {
    parse(ctx: ParserContext, modifiers: QueryModifiers): boolean;
}

/**
 * Handles 'WHERE' / 'WITH' filter clauses.
 */
class FilterModifierParser implements ModifierParser {
    parse(ctx: ParserContext, modifiers: QueryModifiers): boolean {
        if (!ctx.ts.match("with") && !ctx.ts.match("where")) {
            return false;
        }

        ctx.ts.consume(); // Consume 'with'/'where'
        modifiers.filters = parseExpression(ctx.ts);
        return true;
    }
}

/**
 * Handles 'ORDER BY' / 'SORT BY' clauses.
 */
class OrderByModifierParser implements ModifierParser {
    parse(ctx: ParserContext, modifiers: QueryModifiers): boolean {
        if (!ctx.ts.match("sort by") && !ctx.ts.match("order by")) {
            return false;
        }

        ctx.ts.consume();
        const column = ctx.ts.expect("WORD").value;
        let direction: SortDirection = "asc";

        // Check for optional desc/asc specifiers
        if (ctx.ts.match("desc") || ctx.ts.match("descending")) {
            ctx.ts.consume();
            direction = "desc";
        } else if (ctx.ts.match("asc") || ctx.ts.match("ascending")) {
            ctx.ts.consume();
        }

        modifiers.orderBy = { column, direction };
        return true;
    }
}

/**
 * Handles 'LIMIT' clauses.
 */
class LimitModifierParser implements ModifierParser {
    parse(ctx: ParserContext, modifiers: QueryModifiers): boolean {
        if (!ctx.ts.match("limit")) {
            return false;
        }

        ctx.ts.consume();
        modifiers.limit = parsePositiveInteger(ctx.ts.expect("NUMBER"), "LIMIT");
        return true;
    }
}

// Registry of supported trailing modifier parsers
const modifierParsers: ModifierParser[] = [
    new FilterModifierParser(),
    new OrderByModifierParser(),
    new LimitModifierParser(),
];

/**
 * Repeatedly tries to parse trailing modifiers (filters, limits, sorting)
 * until the token stream is exhausted.
 */
function parseTrailingModifiers(
    ctx: ParserContext,
    defaults: QueryModifiers = {}
): QueryModifiers {
    const modifiers: QueryModifiers = { ...defaults };

    while (!ctx.ts.isEnd()) {
        let matched = false;

        for (const parser of modifierParsers) {
            const snapshot = ctx.ts.snapshot(); // Save position for backtracking

            try {
                if (parser.parse(ctx, modifiers)) {
                    matched = true;
                    break;
                }
            } catch (error) {
                // If a sub-parser fails halfway through, rewind so others can try or error cleanly
                ctx.ts.restore(snapshot);
                throw error;
            }
        }

        // If no parser understood the trailing tokens, the query is invalid
        if (!matched) {
            throw new ParseError(`Unexpected trailing token: "${ctx.ts.peek()?.value}"`);
        }
    }

    return modifiers;
}

/**
 * Validates that a token represents a strictly positive integer.
 */
function parsePositiveInteger(token: Token, label: string): number {
    const value = Number(token.value);
    if (!Number.isInteger(value) || value <= 0) {
        throw new ParseError(`${label} must be a positive integer, got "${token.value}"`);
    }

    return value;
}

interface SelectPrefixResult {
    table: string;
    columns: string[];
    defaultModifiers?: QueryModifiers;
}

interface SelectPrefixParser {
    supports(ctx: ParserContext): boolean;
    parse(ctx: ParserContext): SelectPrefixResult;
}

/**
 * Parses queries starting with "top X [table]".
 * E.g., "top 10 users"
 */
class TopSelectPrefixParser implements SelectPrefixParser {
    supports(ctx: ParserContext): boolean {
        return ctx.ts.match("top");
    }

    parse(ctx: ParserContext): SelectPrefixResult {
        ctx.ts.expect("KEYWORD", "top");
        const limit = parsePositiveInteger(ctx.ts.expect("NUMBER"), "LIMIT");
        const table = ctx.ts.expect("WORD").value;

        return {
            table,
            columns: ["*"],
            defaultModifiers: { limit }, // Injects the implied limit
        };
    }
}

/**
 * Parses queries starting with temporal keywords.
 * E.g., "latest orders" -> Sort by created_at DESC
 */
class TemporalSelectPrefixParser implements SelectPrefixParser {
    supports(ctx: ParserContext): boolean {
        return ctx.ts.match("latest") || ctx.ts.match("oldest");
    }

    parse(ctx: ParserContext): SelectPrefixResult {
        const keyword = ctx.ts.consume().value;
        const table = ctx.ts.expect("WORD").value;
        // TODO: Hardcoded table names are not a good idea
        // what if the table name is "updated_at"? 
        const defaultModifiers: QueryModifiers = {
            orderBy: {
                column: "created_at",
                direction: keyword === "latest" ? "desc" : "asc",
            },
        };

        // If the table name is singular (e.g., "latest user"), imply LIMIT 1
        if (!table.endsWith("s")) {
            defaultModifiers.limit = 1;
        }

        return {
            table,
            columns: ["*"],
            defaultModifiers,
        };
    }
}

/**
 * Parses standard selection queries.
 * E.g., "show users", "list id, name from users"
 */
class StandardSelectPrefixParser implements SelectPrefixParser {
    supports(): boolean {
        return true; // Fallback parser
    }

    parse(ctx: ParserContext): SelectPrefixResult {
        // Optionally consume verb prefixes
        if (this.isSelectKeyword(ctx.ts.peek())) {
            ctx.ts.consume();
        }

        const prefixTokens = this.consumePrefixTokens(ctx.ts);
        if (prefixTokens.length === 0) {
            throw new ParseError("Expected table name");
        }

        // Case: "show users" -> table is 'users', columns are '*'
        if (prefixTokens.length === 1) {
            return {
                table: prefixTokens[0],
                columns: ["*"],
            };
        }

        // Case: "show id name from users"
        const fromIndex = prefixTokens.findIndex((token) => token === "from");
        if (fromIndex === -1) {
            throw new ParseError("Expected \"from\" before table name");
        }

        const columns = prefixTokens.slice(0, fromIndex);
        const table = prefixTokens[fromIndex + 1];

        if (columns.length === 0 || table === undefined || fromIndex !== prefixTokens.length - 2) {
            throw new ParseError("Expected columns before \"from\" and one table after it");
        }

        return { table, columns };
    }

    private consumePrefixTokens(ts: TokenStream): string[] {
        const tokens: string[] = [];

        while (!ts.isEnd() && !this.isModifierStart(ts.peek())) {
            const token = ts.consume();

            if (token.type !== "WORD" && !(token.type === "KEYWORD" && token.value === "from")) {
                throw new ParseError(`Unexpected token in select prefix: "${token.value}"`);
            }

            tokens.push(token.value);
        }

        return tokens;
    }

    private isSelectKeyword(token: Token | undefined): boolean {
        return (
            token?.type === "KEYWORD" &&
            ["show", "list", "give", "fetch", "get"].includes(token.value)
        );
    }

    private isModifierStart(token: Token | undefined): boolean {
        return (
            token?.type === "KEYWORD" &&
            ["with", "where", "sort by", "order by", "limit"].includes(token.value)
        );
    }
}

/**
 * Top-level parser for selection queries.
 * Delegates to the appropriate Prefix Parser, then handles modifiers.
 */
class SelectQueryParser implements QueryParser {
    private readonly prefixParsers: SelectPrefixParser[] = [
        new TopSelectPrefixParser(),
        new TemporalSelectPrefixParser(),
        new StandardSelectPrefixParser(),
    ];

    supports(ctx: ParserContext): boolean {
        const next = ctx.ts.peek();
        return (
            next !== undefined &&
            (next.type === "WORD" ||
                (next.type === "KEYWORD" &&
                    ["show", "list", "give", "fetch", "get", "top", "latest", "oldest"].includes(next.value)))
        );
    }

    parse(ctx: ParserContext): QueryAST {
        const prefixParser = this.prefixParsers.find((parser) => parser.supports(ctx));
        if (!prefixParser) {
            throw new ParseError("No matching select parser found");
        }

        // Parse main clause
        const prefix = prefixParser.parse(ctx);
        // Parse trailing modifiers passing along any defaults injected by the prefix parser
        const modifiers = parseTrailingModifiers(ctx, prefix.defaultModifiers);

        return buildSelectAST(prefix.table, prefix.columns, modifiers);
    }
}

/**
 * Top-level parser for aggregation queries.
 * Handles queries starting with "count", "sum", "avg", etc.
 */
class AggregateQueryParser implements QueryParser {
    supports(ctx: ParserContext): boolean {
        const next = ctx.ts.peek();
        return next !== undefined && next.type === "KEYWORD" && next.value in AGGREGATE_FUNCTIONS;
    }

    parse(ctx: ParserContext): QueryAST {
        const start = ctx.ts.consume();
        if (start.type !== "KEYWORD" || !(start.value in AGGREGATE_FUNCTIONS)) {
            throw new ParseError(`Expected aggregate keyword, got "${start.value}"`);
        }

        const aggregateFunction = AGGREGATE_FUNCTIONS[start.value];
        const { table, column } = this.parseTarget(ctx, aggregateFunction);
        const modifiers = parseTrailingModifiers(ctx);

        if (modifiers.orderBy) {
            throw new ParseError("ORDER BY is only supported for select queries");
        }

        return buildAggregateAST(
            { function: aggregateFunction, column },
            table,
            modifiers
        );
    }

    /**
     * Determines the target table and (optional) column for aggregation.
     */
    private parseTarget(
        ctx: ParserContext,
        aggregateFunction: AggregateFunction
    ): { table: string; column?: string } {
        // Pattern: "count from users"
        if (ctx.ts.match("from")) {
            ctx.ts.consume();
            return { table: ctx.ts.expect("WORD").value };
        }

        const word = ctx.ts.expect("WORD").value;

        // Pattern: "sum amount from payments"
        if (ctx.ts.match("from")) {
            ctx.ts.consume();
            return {
                column: word,
                table: ctx.ts.expect("WORD").value,
            };
        }

        // Pattern: "count users"
        if (aggregateFunction === "count") {
            return { table: word };
        }

        throw new ParseError(`Expected "from" after aggregate column "${word}"`);
    }
}

// Registry of supported top-level parsers
const queryParsers: QueryParser[] = [
    new AggregateQueryParser(),
    new SelectQueryParser(),
];

/**
 * Main parser entry point.
 * Initializes the TokenStream and dispatches to the matching top-level QueryParser.
 * * @param tokens The array of tokens generated by the tokenizer.
 * @throws {ParseError} If the syntax is invalid or unsupported.
 * @returns The generated QueryAST.
 */
export function parse(tokens: Token[]): QueryAST {
    const ctx: ParserContext = {
        ts: new TokenStream(tokens),
    };

    const first = ctx.ts.peek();
    if (!first) {
        throw new ParseError("Empty query");
    }

    // Find the right strategy to parse the overall query
    const parser = queryParsers.find((candidate) => candidate.supports(ctx));
    if (!parser) {
        throw new ParseError(`Unsupported query starting with: "${first.value}"`);
    }

    return parser.parse(ctx);
}
