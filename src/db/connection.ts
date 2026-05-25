import postgres from "postgres";

let sqlInstance: postgres.Sql | null = null;

type ConnectOptions = {
  database: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
};

export function connectDB(options: ConnectOptions) {
  const {
    database,
    host,
    port,
    user,
    password,
  } = options;


  sqlInstance = postgres({
    host,
    port,
    database,
    username: user,
    password,
  });

  return sqlInstance;
}

export function getDB() {
  if (!sqlInstance) {
    throw new Error("Database not connected");
  }

  return sqlInstance;
}
