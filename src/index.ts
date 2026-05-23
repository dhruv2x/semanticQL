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

import { tokenize } from "./core/tokenizer/index";
import { parse } from "./core/parser/index";
import { buildSql } from "./core/sql-builder/index";
import { normalize, NormalizeResult } from "./core/normalizer/index";
import type { QueryAST } from "./core/ast/types";
import type { Token } from "./core/tokenizer";

/** Public convenience type re-export */
export type { QueryAST, NormalizeResult };
export { normalize };

export interface SemanticQLResult {
  tokens: Token[];
  ast: QueryAST;
  sql: string;
  params: (string | number)[];
}

/**
 * Convert a plain-English query string into a parameterized SQL statement.
 * Note: Assumes input has already been verified as a non-raw query.
 *
 * @param input  Natural-language query
 * @returns      { tokens, ast, sql, params } ready for use with a PostgreSQL client
 * @throws       ParseError  if the input does not match a grammar
 */
export function semanticQL(input: string): SemanticQLResult {
    const normalization = normalize(input);
    const workingQuery = normalization.isRaw ? normalization.rawSql! : normalization.query!;
    const tokens = tokenize(workingQuery);
    const ast = parse(tokens);
    const { sql, params } = buildSql(ast);
    return { tokens, ast, sql, params };
}
