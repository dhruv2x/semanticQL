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

import type { QueryAST } from "../ast/types";

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
        case "count":
            return buildCountQuery(ast);
        default: {
            // Exhaustiveness check — TypeScript will warn if a new type is added
            // to QueryType without a matching case here.
            const _exhaustive: never = ast.type;
            throw new Error(`[SemanticQL SqlBuilder] Unknown query type: ${_exhaustive}`);
        }
    }
}

/**
 * Build a count query.
 * @param {QueryAST} ast an AST to convert to SQL
 * @returns {SqlResult} an object with sql and params
 */
function buildCountQuery(ast: QueryAST): SqlResult {
    validateIdentifier(ast.table, "table");

    const params: (string | number)[] = [];
    const conditions: string[] = [];

    for (const filter of ast.filters) {
        validateIdentifier(filter.column, "column");
        params.push(filter.value);
        conditions.push(`${filter.column} ${filter.operator} $${params.length}`);
    }

    let sql = "";
    if (conditions.length > 0) {
        sql = `SELECT COUNT(*)\nFROM ${ast.table}\nWHERE ${conditions.join(" AND ")};`;
    } else {
        sql = `SELECT COUNT(*) FROM ${ast.table};`;
    }

    return { sql, params };
}
