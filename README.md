
# SemanticQL 

SemanticQL is a lightweight CLI that lets you query PostgreSQL in plain English directly from your terminal without AI agents or heavy abstractions.

## The Philosophy
This is an **experimental project** built to understand the under-the-hood structure of parsers, tokenizers, and ASTs (Abstract Syntax Trees). The goal is to make everyday database lookups feel fast, intuitive, and less annoying. 

You do need reasonably clear English, but you definitely don't need to be **Shashi Tharoor**. Simple, everyday words are all it takes.

**Before:**
```sql
SELECT *
FROM users
WHERE country = 'india'
ORDER BY signup_date DESC;
```
**After:**
```bash
semanticql > show me users with country india sort by signup_date desc
```
yes! that simple.
## Installation

If PostgreSQL is already configured locally (psql setup), SemanticQL automatically uses the existing connection configuration.
```bash

# 1. Install globally:
npm install -g semanticql


# 2. Start the CLI:
semanticql db_name
```
## Usage Examples

####  1. Normal Mode

try typing:
```bash
semanticql > show users
semanticql > how many website
semanticql > top 10 orders sort by amount descending
semanticql > show name, email from customers where age is greater than 18
```

#### 1. Debug Mode

Want to inspect the generated SQL?
```bash
semanticql > show users -d
```
#### 3. Raw SQL Mode

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