/**
 * SemanticQL SQL Builder
 *
 * Converts a QueryAST into a parameterized PostgreSQL SQL string and a params array.
 *
 * Safety guarantee:
 * No values are ever interpolated directly into the SQL string. All user-supplied
 * values are placed in the `params` array and referenced as placeholders ($1, $2, etc.).
 * Table and column names are validated against a strict alphanumeric identifier pattern
 * to eliminate any SQL injection vector.
 */

import type {
    AggregateQueryAST,
    Condition,
    Operator,
    QueryAST,
    QueryModifiers,
    SelectQueryAST,
} from "../ast/types.js";

/**
 * The final output of the SQL builder, ready to be passed to a PostgreSQL client.
 */
export interface SqlResult {
    /** The parameterized SQL query string (e.g., "SELECT * FROM users WHERE age > $1;") */
    sql: string;
    /** The array of values corresponding to the placeholders in the SQL string */
    params: (string | number)[];
}

/**
 * Validates that `name` is a safe SQL identifier.
 * * Rules:
 * - Only letters, digits, and underscores are allowed.
 * - Must start with a letter or underscore.
 *
 * This is a critical security boundary. Because table and column names cannot be 
 * parameterized in PostgreSQL, they must be validated against an allowlist pattern 
 * to prevent SQL injection.
 *
 * @param name - The identifier (table or column name) to validate.
 * @param kind - Contextual label for error reporting ("table" or "column").
 * @throws {Error} If the identifier contains invalid/unsafe characters.
 */
function validateIdentifier(name: string, kind: "table" | "column"): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(
            `[SemanticQL SqlBuilder] Unsafe ${kind} identifier: "${name}"`
        );
    }
}

function isTextMatchOperator(operator: Operator): boolean {
    return ["like", "contains", "startsWith", "endsWith"].includes(operator);
}

function formatTextMatchValue(operator: Operator, value: string | number): string {
    const text = String(value);

    switch (operator) {
        case "like":
        case "contains":
            return `%${text}%`;
        case "startsWith":
            return `${text}%`;
        case "endsWith":
            return `%${text}`;
        default:
            throw new Error(`[SemanticQL SqlBuilder] Unsupported text-match operator: "${operator}"`);
    }
}

/**
 * Main entry point for the SQL Builder.
 * Routes the AST to the appropriate specific builder based on the query type.
 * * @param ast - The root Abstract Syntax Tree node.
 * @returns {SqlResult} An object containing the SQL string and parameters array.
 * @throws {Error} If an unknown or unsupported query type is provided.
 */
export function buildSql(ast: QueryAST): SqlResult {
    switch (ast.type) {
        case "aggregate":
            return buildAggregateQuery(ast);
        case "select":
            return buildSelectQuery(ast);
        default: {
            // Exhaustiveness check — TypeScript will fail to compile if a new type 
            // is added to QueryType without a matching case block here.
            const _exhaustive: never = ast;
            throw new Error(`[SemanticQL SqlBuilder] Unknown query type: ${_exhaustive}`);
        }
    }
}

/**
 * Recursively constructs the SQL string for logical conditions (WHERE clauses).
 * * @param condition - The current condition node (either a leaf filter or a logical AND/OR).
 * @param params - A mutable array of parameters. Values are pushed here, and their 
 * resulting 1-based index is used to generate the SQL placeholder (e.g., $1).
 * @returns {string} The constructed SQL condition string.
 */
function buildConditionSql(
    condition: Condition,
    params: (string | number)[]
): string {
    if (condition.type === "filter") {
        // Base case: a single column comparison
        validateIdentifier(condition.column, "column");
        const sqlOperator = isTextMatchOperator(condition.operator) ? "ILIKE" : condition.operator;
        const value = isTextMatchOperator(condition.operator)
            ? formatTextMatchValue(condition.operator, condition.value)
            : condition.value;

        params.push(value);
        
        // params.length works perfectly as the placeholder index because 
        // Postgres placeholders are 1-indexed ($1, $2) and arrays are 0-indexed.
        return `${condition.column} ${sqlOperator} $${params.length}`;
    } else {
        // Recursive case: AND / OR groupings
        const leftSql = buildConditionSql(condition.left, params);
        const rightSql = buildConditionSql(condition.right, params);
        
        // Wrap in parentheses to ensure correct logical evaluation precedence
        return `(${leftSql} ${condition.operator.toUpperCase()} ${rightSql})`;
    }
}

/**
 * Appends an ORDER BY clause to the query string if specified.
 * * @param sql - The base SQL query constructed so far.
 * @param modifiers - The modifiers object containing potential sort instructions.
 * @returns {string} The updated SQL string.
 */
function appendOrderBy(sql: string, modifiers: QueryModifiers): string {
    if (!modifiers.orderBy) {
        return sql;
    }

    validateIdentifier(modifiers.orderBy.column, "column");
    return `${sql}\nORDER BY ${modifiers.orderBy.column} ${modifiers.orderBy.direction.toUpperCase()}`;
}

/**
 * Appends a LIMIT clause to the query string if specified.
 * * @param sql - The base SQL query constructed so far.
 * @param modifiers - The modifiers object containing potential limit instructions.
 * @param params - The mutable parameters array to push the limit value into.
 * @returns {string} The updated SQL string.
 * @throws {Error} If the limit is not a valid positive integer.
 */
function appendLimit(sql: string, modifiers: QueryModifiers, params: (string | number)[]): string {
    if (modifiers.limit === undefined) {
        return sql;
    }

    if (!Number.isInteger(modifiers.limit) || modifiers.limit <= 0) {
        throw new Error(`[SemanticQL SqlBuilder] LIMIT must be a positive integer: "${modifiers.limit}"`);
    }

    // Parameterize the limit value to prevent injection, even though it's an integer
    params.push(modifiers.limit);
    return `${sql}\nLIMIT $${params.length}`;
}

/**
 * Convenience wrapper to apply all trailing query modifiers in the correct sequence.
 * (ORDER BY must precede LIMIT in PostgreSQL syntax).
 * * @param sql - The base SQL query.
 * @param modifiers - The modifiers requested by the AST.
 * @param params - The mutable parameters array.
 * @returns {string} The finalized SQL query string (without the trailing semicolon).
 */
function appendQueryModifiers(sql: string, modifiers: QueryModifiers, params: (string | number)[]): string {
    return appendLimit(appendOrderBy(sql, modifiers), modifiers, params);
}

/**
 * Builds a SQL query for aggregate operations (COUNT, SUM, AVG, MAX, MIN).
 * * @param ast - The aggregate-specific AST node.
 * @returns {SqlResult} The finalized query and parameters.
 */
function buildAggregateQuery(ast: AggregateQueryAST): SqlResult {
    validateIdentifier(ast.table, "table");

    const aggregateFunction = ast.aggregate.function.toUpperCase();
    const aggregateTarget = ast.aggregate.column ?? "*";
    
    // '*' is valid inside aggregate functions (e.g., COUNT(*)), otherwise validate the column name
    if (aggregateTarget !== "*") {
        validateIdentifier(aggregateTarget, "column");
    }

    const params: (string | number)[] = [];
    let sql = "";

    // 1. Construct base SELECT and FROM with optional WHERE
    if (ast.modifiers.filters) {
        const whereClause = buildConditionSql(ast.modifiers.filters, params);
        sql = `SELECT ${aggregateFunction}(${aggregateTarget})\nFROM ${ast.table}\nWHERE ${whereClause}`;
    } else {
        sql = `SELECT ${aggregateFunction}(${aggregateTarget}) FROM ${ast.table}`;
    }

    // 2. Append trailing modifiers
    sql = appendQueryModifiers(sql, ast.modifiers, params);

    // 3. Terminate query and return
    return { sql: `${sql};`, params };
}

/**
 * Builds a standard SQL SELECT query.
 * * @param ast - The select-specific AST node.
 * @returns {SqlResult} The finalized query and parameters.
 */
function buildSelectQuery(ast: SelectQueryAST): SqlResult {
    validateIdentifier(ast.table, "table");

    const selectColumns = ast.columns;
    
    // Validate all requested columns unless it's a wildcard select
    for (const col of selectColumns) {
        if (col !== "*") {
            validateIdentifier(col, "column");
        }
    }

    const selectColumnsStr = selectColumns.join(", ");
    const params: (string | number)[] = [];
    let sql = "";

    // 1. Construct base SELECT and FROM with optional WHERE
    if (ast.modifiers.filters) {
        const whereClause = buildConditionSql(ast.modifiers.filters, params);
        sql = `SELECT ${selectColumnsStr}\nFROM ${ast.table}\nWHERE ${whereClause}`;
    } else {
        sql = `SELECT ${selectColumnsStr} FROM ${ast.table}`;
    }

    // 2. Append trailing modifiers
    sql = appendQueryModifiers(sql, ast.modifiers, params);

    // 3. Terminate query and return
    return { sql: `${sql};`, params };
}
