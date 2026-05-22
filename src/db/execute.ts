import { getDB } from "./connection";
import { semanticQL } from "../index";

export async function executeQuery(query: string) {
  const result = semanticQL(query);

  return await executeSQL(result.sql, result.params);
}

export async function executeSQL(sqlQuery: string, params: (string | number)[]) {
  const sql = getDB();
  return await sql.unsafe(sqlQuery, params);
}
