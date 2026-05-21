/**
 * SemanticQL — main entry point
 *
 * Wires together the four pipeline stages:
 *   Raw English string
 *     → Tokenizer  (produces Token[])
 *     → Parser     (produces QueryAST)
 *     → SQL Builder (produces { sql, params })
 *
 * No database connection is made.  The output is a ready-to-use
 * parameterized query you can pass directly to `pg.query(sql, params)`.
 */

import { tokenize } from "./tokenizer/index";
import { parse } from "./parser/index";
import { buildSql } from "./sql-builder/index";
import type { QueryAST } from "./ast/types";

/** Public convenience type re-export */
export type { QueryAST };

/**
 * Convert a plain-English query string into a parameterized SQL statement.
 *
 * @param input  Natural-language query
 * @returns      { sql, params } ready for use with a PostgreSQL client
 * @throws       ParseError  if the input does not match a grammar
 */
export function semanticQL(input: string): { sql: string; params: (string | number)[]; ast: QueryAST } {
    const tokens = tokenize(input);
    const ast = parse(tokens);
    const { sql, params } = buildSql(ast);
    return { sql, params, ast };
}
