/**
 * AST Type Definitions for SemanticQL
 *
 * Mirrors the conceptual structure PostgreSQL uses internally:
 * - Tokenize raw text into a token stream
 * - Parse tokens into a typed AST node
 * - The SQL builder then does "query planning" to emit parameterized SQL
 */

/** Supported SQL operators */
export type Operator = "=" | ">" | "<" | ">=" | "<=";

/** A single WHERE-clause condition */
export interface Filter {
    column: string;
    operator: Operator;
    value: string | number;
}

/** Logical group or single filter condition */
export type Condition =
    | { type: "filter"; column: string; operator: Operator; value: string | number }
    | { type: "logical"; operator: "and" | "or"; left: Condition; right: Condition };

/** All supported top-level query intents */
export type QueryType = "count";

/**
 * The root AST node produced by the parser.
 * Analogous to PostgreSQL's SelectStmt / Query node in its internal parse tree.
 */
export interface QueryAST {
    type: QueryType;
    table: string;
    filters?: Condition;
}
