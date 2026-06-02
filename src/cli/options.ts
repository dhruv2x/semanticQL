/**
 * SemanticQL CLI — Options parsing module
 *
 * Responsible for parsing command-line arguments and environment variables
 * to configure the PostgreSQL database connection.
 *
 * Responsibilities:
 * - Parsing connection strings and standard Postgres CLI flags (-d, -h, -p, -U, -W)
 * - Resolving environment variable fallbacks (PG* and DB_* conventions)
 * - Invoking secure interactive password prompts when required
 * - Generating CLI usage instructions
 */

import { promptForPassword } from "./prompt.js";

/**
 * Database connection configuration options extracted from CLI flags,
 * environment variables, or a connection URL.
 */
export type CliConnectOptions = {
  database?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  connectionString?: string;
};

/**
 * Result of the CLI option parsing phase.
 */
type ParsedCliOptions = {
  /** The fully resolved connection options to pass to the DB client */
  connectOptions: CliConnectOptions;
  /** Flag indicating if the user requested the help/usage menu */
  showHelp: boolean;
  showGrammar: boolean;
};

/**
 * Recognized flags for displaying the help menu.
 */
const HELP_FLAGS = new Set(["--help", "-?"]);
const GRAMMAR_FLAGS = new Set(["--grammar", "-g"]);

/**
 * Prints the standard CLI usage instructions, showing available flags,
 * connection string formats, and environment variable fallbacks.
 */
export function printUsage(): void {
  console.log(`
Usage:
  semanticql [database] [connection options]
  semanticql -d <database> -h <host> -p <port> -U <user>
  semanticql <postgres-url>

Connection options:
  -d, --dbname <database>     Database name
  -h, --host <host>           Database server host
  -p, --port <port>           Database server port
  -U, --username <user>       Database user
  -W, --password [password]   Prompt for a password, or use the provided value
  --url <postgres-url>        PostgreSQL connection URL

Environment fallbacks:
  PGDATABASE, PGHOST, PGPORT, PGUSER, PGPASSWORD
  DB_NAME, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DATABASE_URL
`);
}

/**
 * Parses raw command-line arguments and system environment variables into
 * structured database connection options. 
 *
 * Handles standard POSIX flag formats (e.g., `--host localhost` and `--host=localhost`),
 * falls back to environment variables if arguments are omitted, and triggers an 
 * interactive password prompt if the `-W` flag is provided without a value.
 *
 * @param argv - The raw process.argv array (excluding the node executable and script path).
 * @param env  - The process.env object containing environment variables.
 * @returns {Promise<ParsedCliOptions>} A promise resolving to the parsed options and routing flags.
 * @throws {Error} If an unknown flag is provided or a required value is missing.
 */
export async function parseCliOptions(
  argv: string[],
  env: NodeJS.ProcessEnv
): Promise<ParsedCliOptions> {
  const connectOptions: CliConnectOptions = {};
  let shouldPromptForPassword = false;

  // 1. Explicitly define which keys are string-based to satisfy TypeScript
  type StringOptionKeys = "database" | "host" | "user" | "connectionString";

  // 2. Strongly type the map to only use those string keys
  const flagMap: Record<string, StringOptionKeys> = {
    "--url": "connectionString",
    "-d": "database", "--dbname": "database",
    "-h": "host", "--host": "host",
    "-U": "user", "--username": "user",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (HELP_FLAGS.has(arg)) {
      return { connectOptions, showHelp: true, showGrammar: false };
    }

    if (GRAMMAR_FLAGS.has(arg)) {
      return { connectOptions, showHelp: false, showGrammar: true };
    }

    // Handle password separately because of its optional inline value behavior
    if (arg === "-W" || arg === "--password") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        connectOptions.password = next;
        i++;
      } else {
        shouldPromptForPassword = true;
      }
      continue;
    }

    if (arg.startsWith("--password=")) {
      connectOptions.password = arg.slice("--password=".length);
      continue;
    }

    // Process mapped string flags
    const matchedFlag = Object.keys(flagMap).find(f => arg === f || arg.startsWith(`${f}=`));
    
    if (matchedFlag) {
      // Cast the key to our explicit string-only type
      const key = flagMap[matchedFlag] as StringOptionKeys;
      const isAssignment = arg.startsWith(`${matchedFlag}=`);
      
      connectOptions[key] = isAssignment 
        ? arg.slice(matchedFlag.length + 1) 
        : readRequiredValue(argv, ++i, arg);
      continue;
    }

    // Process port separately since it requires numeric parsing
    if (arg === "-p" || arg === "--port") {
      connectOptions.port = parsePort(readRequiredValue(argv, ++i, arg));
      continue;
    }
    
    if (arg.startsWith("--port=")) {
      connectOptions.port = parsePort(arg.slice("--port=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (isPostgresUrl(arg)) {
      connectOptions.connectionString = arg;
      continue;
    }

    if (connectOptions.database) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    // Unflagged positional arguments are treated as the database name
    connectOptions.database = arg;
  }

  // Backfill missing options using standard Postgres/Docker environment variables
  applyEnvironmentDefaults(connectOptions, env);

  // Interactively prompt for the password if -W was used without an inline value
  if (shouldPromptForPassword && !connectOptions.password) {
    connectOptions.password = await promptForPassword();
  }

  return { connectOptions, showHelp: false, showGrammar: false };
}

/**
 * Generates a human-readable description of the target database connection.
 * Used for displaying the welcoming banner in the REPL.
 *
 * @param options - The resolved connection options.
 * @returns {string} A summarized string of the database connection target.
 */
export function describeConnectionTarget(options: CliConnectOptions): string {
  if (options.database) {
    return options.database;
  }

  if (!options.connectionString) {
    return "default";
  }

  try {
    const url = new URL(options.connectionString);
    // Return the database name (path) or fallback to the host
    return url.pathname.replace(/^\//, "") || url.hostname || "connection URL";
  } catch {
    return "connection URL";
  }
}

/**
 * Populates missing connection options using standard environment variables.
 * Prioritizes standard DB_* variables, then falls back to standard Postgres PG* variables.
 *
 * @param options - The mutable connection options object to backfill.
 * @param env     - The active process environment variables.
 */
function applyEnvironmentDefaults(
  options: CliConnectOptions,
  env: NodeJS.ProcessEnv
): void {
  options.connectionString ??= env.DATABASE_URL;
  options.user ??= env.DB_USER ?? env.PGUSER ?? env.USER ?? env.USERNAME ?? "postgres";
  options.database ??= env.DB_NAME ?? env.PGDATABASE ?? options.user;
  options.host ??= env.DB_HOST ?? env.PGHOST ?? "/var/run/postgresql";
  options.port ??= parseOptionalPort(env.DB_PORT ?? env.PGPORT) ?? 5432;
  options.password ??= env.DB_PASSWORD ?? env.PGPASSWORD;
}

/**
 * Helper to extract the next value from the argv array for flags that require a value.
 *
 * @param argv  - The argument array.
 * @param index - The index of the expected value.
 * @param flag  - The flag that requested this value (for error reporting).
 * @returns {string} The extracted string value.
 * @throws {Error} If the value is missing or appears to be another flag.
 */
function readRequiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`Expected a value after ${flag}`);
  }

  return value;
}

/**
 * Safely parses an optional string value into a port number.
 *
 * @param value - The optional string representing a port.
 * @returns {number | undefined} The parsed port, or undefined if no value was given.
 */
function parseOptionalPort(value: string | undefined): number | undefined {
  return value ? parsePort(value) : undefined;
}

/**
 * Parses a string into a valid network port number.
 *
 * @param value - The string to parse.
 * @returns {number} The validated port number.
 * @throws {Error} If the port is not an integer or is out of the valid 1-65535 range.
 */
function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

/**
 * Evaluates whether a string looks like a PostgreSQL connection URL.
 *
 * @param value - The string to check.
 * @returns {boolean} True if it starts with standard postgres protocol identifiers.
 */
function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}
