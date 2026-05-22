import { getDB } from "./connection";
import { semanticQL } from "../index";

export async function executeQuery(query: string) {
  const sql = getDB();
  const { sql: sqlQuery, params } = semanticQL(query);

  return await sql.unsafe(sqlQuery, params);
}
