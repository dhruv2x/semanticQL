import postgres from "postgres";

let sqlInstance: postgres.Sql | null = null;

export type ConnectOptions = {
  database?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  connectionString?: string;
};

export function connectDB(options: ConnectOptions) {
  const {
    database,
    host,
    port,
    user,
    password,
    connectionString,
  } = options;

  if (connectionString) {
    sqlInstance = postgres(connectionString);
    return sqlInstance;
  }

  sqlInstance = postgres(removeUndefinedValues({
    host,
    port,
    database,
    username: user,
    password,
  }));

  return sqlInstance;
}

export function getDB() {
  if (!sqlInstance) {
    throw new Error("Database not connected");
  }

  return sqlInstance;
}

export async function validateDBConnection() {
  const sql = getDB();
  await sql`SELECT 1`;
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined && entry[1] !== "")
  ) as Partial<T>;
}
