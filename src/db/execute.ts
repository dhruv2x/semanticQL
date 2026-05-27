import { getDB } from "./connection.js";
import { semanticQL } from "../index.js";

export async function executeQuery(query: string) {
  const result = semanticQL(query);

  return await executeSQL(result.sql, result.params);
}

export async function executeSQL(sqlQuery: string, params: (string | number)[]) {
  const sql = getDB();
  return await sql.unsafe(sqlQuery, params);
}
