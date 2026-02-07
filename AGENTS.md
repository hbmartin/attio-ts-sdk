# Working Guide

- After adding any code or functionality, write thorough unit tests and check coverage.
- After making any changes always execute `pnpm format && pnpm dupes && pnpm test && pnpm build` to verify
- Fix any pnpm format issues (even if they are unrelated)
- Never edit files in src/generated/
- Whenever there is any confusion or errors, suggest to me a guideline to add to AGENTS.md
- Make commits after changes, always using conventional commits

## Goals

- Explicit contracts at boundaries
- No business rules in services.
- Centralize boundary validation + error mapping. Add zod DTOs for all HTTP entrypoints.
- Always use Zod for parsing types from external sources (including form data)

# TypeScript

- **Type everything**: params, returns, config objects, and external integrations; avoid `any`
- **Use interfaces**: for complex types and objects, including ports and DTOs
- **Use namespaces**: for organizing related types and functions
- **Make Illegal States Unrepresentable**: If something should never happen, encode that rule in the type system instead of comments or runtime checks.
  - Discriminated unions instead of flags + nullable fields
  - Narrowed constructors / factory functions
- **Avoid using bare string types** - prefer Branded domain types instead of primitives
  - Brand types especially for strings e.g. phone, email, ID
  - e.g. NormalizedEmail, UserId, ChatId
- **Avoid Type Assertions (as)**: Every as is a potential runtime crash hidden from the compiler.
  - Replace with: Narrowing functions or Exhaustive pattern matching or Refined input types
- **Prefer Union Types Over Boolean Flags**: Boolean flags destroy invariants.
- **Separate Pure Logic from Side Effects**: Functions that return void hide meaning from the compiler.
  - Prefer Pure functions with explicit inputs/outputs.
- **Use a single params object for a function argument when there are optional arguments or arguments of the same type**: this enables safe, name-based destructuring.
- **Add comments to tricky parts of code (no need for obvious comments)**: ensure comments on tricky code capture intent
- **Prefer undefined over null** - except at outer boundaries where it's necessary to communicate absence of a value.
- **Avoid uninformative method names** - don't use words like "handle" or "process" in names, use descriptive verbs
- **Avoid type guard functions** - prefer Zod (e.g. for cache policy `isValue`)
- **Avoid creating duplicative types** - prefer to use typescript's `Pick` or `Omit` (if using Zod use `.extend`)
- **Use TypeScript types in server actions** - they are internal so we do not need to use Zod types.
- **Never use Parameters<typeof ...>** - prefer destructuring or param object typing
- **Prefer well typed dispatch objects to switch statements**
