export function isExitCommand(input: string) {
  return ["exit", "quit", "\\q"].includes(input.trim().toLowerCase());
}

export function isHelpCommand(input: string) {
  return input.trim().toLowerCase() === "help";
}

export function printHelp() {
  console.log(`
Available commands:

  help        Show help
  exit        Exit CLI
  \\q          Exit CLI
  
  Query options:
  -d         Run query in debug mode
  -r         Run raw query (can be used at the start or end)

  Startup connection options:
  semanticql my_database
  semanticql -d my_database -h localhost -p 5432 -U postgres -W
  semanticql --url postgres://user:password@localhost:5432/my_database

  ---------------------------------------------------------
Query Examples:

1. Basic Selection:
   - show user_table
   - list id, name from product_table
   - fetch order_table

2. Filtering (using 'with' or 'where'):
   - show user_table where age is 18
   - list product_table with price greater than 100
   - fetch user_table where name starts with 'John'
   - show order_table where status is 'paid' and total > 50

3. Sorting & Limiting:
   - list user_table sort by created_at desc
   - show product_table order by price ascending limit 5
   - top 10 website_table

4. Aggregations (Math):
   - count user_table
   - how many order_table with status is 'shipped'
   - sum amount from payments
   - average price from product_table
   - highest total from order_table

5. Raw SQL Bypass (Use -r flag):
   - -r SELECT * FROM users WHERE id = 1;
   - SELECT COUNT(*) FROM products; -r
`);
}
