/**
 * SemanticQL SQL Builder
 *
 * Converts a QueryAST into a parameterized PostgreSQL SQL string and a params array.
 *
 * Safety guarantee:
 *   No values are ever interpolated directly into the SQL string. All user-supplied
 *   values are placed in the `params` array and referenced as placeholders ($1, $2, etc.).
 *   Table and column names are validated against a strict alphanumeric identifier pattern
 *   to eliminate any SQL injection vector.
 */

import type { AggregateQueryAST, QueryAST, SelectQueryAST, Condition } from "../ast/types";

export interface SqlResult {
    sql: string;
    params: (string | number)[];
}

/**
 * Validate that `name` is a safe SQL identifier (letters, digits, underscore
 * only, must start with a letter or underscore).  Throws if invalid.
 *
 * This prevents SQL injection through table / column names.
 */
function validateIdentifier(name: string, kind: "table" | "column"): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(
            `[SemanticQL SqlBuilder] Unsafe ${kind} identifier: "${name}"`
        );
    }
}

/**
 * Main SQL builder entry point.
 * @param {QueryAST} ast an AST to convert to SQL
 * @returns {SqlResult} an object with sql and params
 */
export function buildSql(ast: QueryAST): SqlResult {
    switch (ast.type) {
        case "aggregate":
            return buildAggregateQuery(ast);
        case "select":
            return buildSelectQuery(ast);
        default: {
            // Exhaustiveness check — TypeScript will warn if a new type is added
            // to QueryType without a matching case here.
            const _exhaustive: never = ast;
            throw new Error(`[SemanticQL SqlBuilder] Unknown query type: ${_exhaustive}`);
        }
    }
}

/**
 * Recursively construct SQL for logical conditions.
 */
function buildConditionSql(
    condition: Condition,
    params: (string | number)[]
): string {
    if (condition.type === "filter") {
        validateIdentifier(condition.column, "column");
        params.push(condition.value);
        return `${condition.column} ${condition.operator} $${params.length}`;
    } else {
        const leftSql = buildConditionSql(condition.left, params);
        const rightSql = buildConditionSql(condition.right, params);
        return `(${leftSql} ${condition.operator.toUpperCase()} ${rightSql})`;
    }
}

/**
 * Build an aggregate query.
 * @param {QueryAST} ast an AST to convert to SQL
 * @returns {SqlResult} an object with sql and params
 */
function buildAggregateQuery(ast: AggregateQueryAST): SqlResult {
    validateIdentifier(ast.table, "table");

    const aggregateFunction = ast.aggregate.function.toUpperCase();
    const aggregateTarget = ast.aggregate.column ?? "*";
    if (aggregateTarget !== "*") {
        validateIdentifier(aggregateTarget, "column");
    }

    const params: (string | number)[] = [];
    let sql = "";

    if (ast.filters) {
        const whereClause = buildConditionSql(ast.filters, params);
        sql = `SELECT ${aggregateFunction}(${aggregateTarget})\nFROM ${ast.table}\nWHERE ${whereClause};`;
    } else {
        sql = `SELECT ${aggregateFunction}(${aggregateTarget}) FROM ${ast.table};`;
    }

    return { sql, params };
}

/**
 * Build a select query.
 * @param {QueryAST} ast an AST to convert to SQL
 * @returns {SqlResult} an object with sql and params
 */
function buildSelectQuery(ast: SelectQueryAST): SqlResult {
    validateIdentifier(ast.table, "table");

    const selectColumns = ast.columns || ["*"];
    for (const col of selectColumns) {
        if (col !== "*") {
            validateIdentifier(col, "column");
        }
    }

    const selectColumnsStr = selectColumns.join(", ");
    const params: (string | number)[] = [];
    let sql = "";

    if (ast.filters) {
        const whereClause = buildConditionSql(ast.filters, params);
        sql = `SELECT ${selectColumnsStr}\nFROM ${ast.table}\nWHERE ${whereClause};`;
    } else {
        sql = `SELECT ${selectColumnsStr} FROM ${ast.table};`;
    }

    return { sql, params };
}
