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

/** Supported aggregate SQL functions */
export type AggregateFunction = "count" | "sum" | "avg" | "max" | "min";

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
export type QueryType = "aggregate" | "select";

interface BaseQueryAST {
    table: string;
    filters?: Condition;
}

export interface AggregateQueryAST extends BaseQueryAST {
    type: "aggregate";
    aggregate: {
        function: AggregateFunction;
        column?: string;
    };
}

export interface SelectQueryAST extends BaseQueryAST {
    type: "select";
    columns?: string[];
}

/**
 * The root AST node produced by the parser.
 * Analogous to PostgreSQL's SelectStmt / Query node in its internal parse tree.
 */
export type QueryAST = AggregateQueryAST | SelectQueryAST;
