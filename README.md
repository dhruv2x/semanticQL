
# SemanticQL 

SemanticQL is a lightweight CLI that lets you query PostgreSQL in plain English directly from your terminal without  **AI agents** or heavy abstractions.

## The Philosophy
This is an **experimental project** built to understand the under-the-hood structure of parsers, tokenizers, and ASTs (Abstract Syntax Trees). The goal is to make everyday database lookups feel fast, intuitive, and less annoying. 

You do need reasonably clear English, but you definitely don't need to be **Shashi Tharoor**. Simple, everyday words are all it takes.

**Before:**
```sql
SELECT *
FROM startups
WHERE founder_name LIKE 'sam%'
ORDER BY funding DESC;
```
**After:**
```bash
semanticql > show startups with founder_name starts with sam sort by funding desc
```
yes! that simple.
## Installation

If PostgreSQL is already configured locally (psql setup), SemanticQL automatically uses the existing connection configuration. SemanticQL is a CLI tool, so you should install it globally.
```bash

# 1. Install globally:
npm install -g semanticql


# 2. Start the CLI:
semanticql db_name
```

### Connecting without psql config

SemanticQL also accepts psql-style connection flags, so it works on macOS,
Windows, Linux, and environments where `psql` is not already configured.

```bash
semanticql -d db_name -h localhost -p 5432 -U postgres -W
semanticql --url postgres://postgres:password@localhost:5432/db_name
```

You can also use PostgreSQL-compatible environment variables:

```bash
PGDATABASE=db_name PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=password semanticql
```

SemanticQL also recognizes `DATABASE_URL`, `DB_NAME`, `DB_HOST`, `DB_PORT`,
`DB_USER`, and `DB_PASSWORD`.

## Usage Examples

####  1. Syntax & Grammar Cheat Sheet
Forget how to filter or sort? SemanticQL comes with a built-in, cheat sheet with examples to get you up and running instantly!

```bash
# View the interactive syntax guide:
semanticql --grammar

# Or use the short flag:
semanticql -g
```

####  2. Normal Mode

try typing:
```bash
semanticql > show users
semanticql > how many website
semanticql > top 10 orders sort by amount descending
semanticql > show name, email from customers where age is greater than 18
```

#### 3. Debug Mode

Want to inspect the generated SQL?
```bash
semanticql > show users -d
```
#### 4. Raw SQL Mode

Need to bypass the SemanticQL engine completely?
```bash
semanticql > -r SELECT * FROM pg_stat_activity;
```
---

## Contributing!

We <3 contributions big and small:
it is a **fantastic** playground for developers wanting to learn how languages and databases work under the hood.

**How you can help:**

1. **Fork the repo** and explore the `src/core` pipeline (Normaliser -> Tokeniser -> Parser -> SQL Builder).
2. **Add a new language parser:** Want to support `lowest`, `average`, or new filter words?
3. **Submit a PR:** We welcome all PRs, from documentation tweaks to massive engine overhauls.

Feel free to open an issue if you have a cool idea or find a bug!

---

Hey! If you're reading this, you've proven yourself as a dedicated README reader. You might also make a great addition to our community.