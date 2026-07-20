# AGENTS.md

## Project overview

Hanami is an osu! Discord bot written in TypeScript and run with Bun. It supports both Discord application commands and legacy prefix commands.

Core technologies:

- Bun runtime and package manager
- TypeScript with ES modules and strict type checking
- Lilybird and `@lilybird/handlers` for Discord
- `osu-api-extended` for osu! API access
- `rosu-pp-js` for performance calculations
- Prisma 6 with MariaDB/MySQL
- Redis for short-lived state, command caches, and pagination data

## Important paths

- `src/index.ts`: process startup, dependency initialization, Discord client creation, and graceful shutdown
- `src/listeners/`: Lilybird event listeners, discovered automatically at startup
- `src/commands/`: command implementations grouped by feature area
- `src/utils/command-context.ts`: shared abstraction for application and prefix commands
- `src/services/`: application orchestration for identity, beatmaps, performance, play rendering, and persistence
- `src/providers/`: score-provider boundaries and external score implementations
- `src/clients/`: HTTP clients such as Hanami Web and osu! leaderboard access
- `src/parsing/` and `src/domain/`: pure input normalization and calculations
- `src/discord/`: Discord-specific adapters such as beatmap context lookup
- `src/utils/`: compatibility helpers, database, Redis, logging, and shared low-level utilities; do not add business logic here
- `src/embed-builders/`: Discord embed construction
- `src/types/`: shared project types
- `prisma/schema.prisma`: MariaDB/MySQL schema
- `tests/`: unit and integration tests

## Setup and commands

Use Bun, not npm, pnpm, yarn, ts-node, or Node-specific runners.

```bash
bun install
cp .env.example .env.local
bunx prisma generate
```

Useful commands:

```bash
bun run dev                 # Run in development mode
bun run dev:no-app          # Development mode without application-command registration
bun run check               # TypeScript and ESLint
bun run format              # Format the repository with Prettier
bun test                    # Run all tests
bun run test:unit           # Run unit tests
bun run test:integration    # Run integration tests
bun run test:all            # Unit tests followed by integration tests
```

For a focused change, run the narrowest relevant test path first:

```bash
bun test tests/utils/<test-file>
bun test tests/commands/<test-file>
```

Before finishing a normal code change, run `bun run check` and the relevant tests. Run integration tests only when their required database, Redis, credentials, and network access are available. State clearly when an integration test could not be run.

## Command architecture

New and migrated commands should use the unified command shape:

```ts
export async function run(ctx: CommandContext): Promise<void> {
    // implementation
}

export const data = {
    name: "example",
    description: "Example command.",
    hasPrefixVariant: true,
    application: {},
    message: {},
} satisfies CommandData;
```

Follow these rules:

- Use `CommandContext` instead of implementing separate slash and prefix logic.
- Preserve both command variants when `hasPrefixVariant` is `true`.
- Use `ctx.args` and shared argument parsers rather than reparsing message content locally.
- Use `ctx.defer()` before slow osu! API, database, Redis, or calculation work.
- After deferring, respond with `ctx.editReply()`.
- Use `ctx.reply()` for immediate responses.
- Use `ctx.ensureGuild()` for guild-only behavior.
- Use `ctx.respondUnavailable()` for unsupported contexts.
- Use `ctx.sendWithPagination()` for paginated command responses.
- Do not assume an interaction is in a guild. Commands can run through DMs and user-installed applications.
- Check `ctx.isGuildContext`, `ctx.isDMContext`, `ctx.isGuildInstall`, `ctx.isUserInstall`, and `ctx.canReadChannelHistory` when context matters.
- Use `ctx.beatmapLookupContext` when resolving a beatmap from message or channel history.
- Keep command metadata in `data` and make it satisfy `CommandData`.
- Preserve existing command names, aliases, option names, availability, and response behavior unless the task explicitly changes them.

Legacy `runMessage` and `runApplication` handlers still exist for compatibility. Do not add new split handlers unless required by an existing unmigrated pattern.

## Discord and Lilybird conventions

- Register listeners with `$listener` from `@utils/lilybird-handler`.
- Keep event-specific orchestration in `src/listeners/` and reusable logic in commands or utilities.
- Prefer Lilybird transformer types over handwritten Discord payload types.
- Use ephemeral replies for interaction-only errors or unavailable private responses where appropriate.
- Avoid acknowledging an interaction more than once. Let `CommandContext` manage reply and defer state.
- Do not bypass the shared command error handler for unexpected failures. Handle only expected, user-recoverable errors inside commands.

## Imports and TypeScript

The project uses ES modules and path aliases from `tsconfig.json`:

- `@utils/*`
- `@type/*`
- `@listeners/*`
- `@builders`

Prefer these aliases for imports from `src/`. Use relative imports only for tightly coupled files in the same directory.

Additional rules:

- Keep strict TypeScript compatibility.
- Prefer `import type` for type-only imports.
- Use `Array<T>` to match the ESLint configuration.
- Prefix intentionally unused parameters or variables with `_`.
- Prefer explicit return types on exported functions and non-trivial helpers.
- Avoid new `any` usage when a reasonable type exists, even though the current ESLint configuration permits it.
- Do not add a production dependency unless it is necessary for the requested change.

## State, database, and external services

- Reuse the existing Prisma client, Redis client, caches, API clients, and initialization helpers. Do not create new global clients inside commands.
- Keep transient data in Redis through existing cache helpers.
- Keep persistent data access in the shared database utilities where practical.
- Do not perform network, database, or Redis work at module import time.
- Do not run the bot using production credentials while testing.
- Never commit `.env`, `.env.local`, tokens, cookies, database URLs, Discord IDs intended to remain private, or generated secrets.
- Treat Prisma schema changes as database changes. Generate the Prisma client and add focused tests or validation for affected behavior.
- Do not run destructive Prisma commands or push schema changes to a production database.

## Logging and errors

- Use the shared `logger` instead of `console.log`.
- Include useful structured context such as command name, guild ID, user ID, map ID, or score ID.
- Do not log tokens, authorization headers, session cookies, full environment variables, or other secrets.
- Preserve the startup and shutdown behavior in `src/index.ts`, including readiness cleanup and client disconnection.
- Convert unknown caught values safely before treating them as `Error` objects.

## Tests

Add or update tests when changing:

- argument parsing
- command behavior
- command context behavior
- embed builders
- osu! calculations
- caching or pagination logic
- database behavior
- fixes for reproducible bugs

Prefer deterministic unit tests. Mock external APIs where practical. Do not make unit tests depend on Discord, osu!, Redis, MariaDB, wall-clock timing, or the public internet.

Integration tests may use real services, but they must not modify production data or require production secrets.

## Change discipline

- Read the complete affected flow before editing. Command behavior often crosses a command file, `CommandContext`, listeners, parsing helpers, builders, and caches.
- Make the smallest coherent change that solves the task.
- Do not reformat or refactor unrelated files.
- Do not silently change public command behavior.
- Keep user-facing error messages clear and consistent with nearby commands.
- Update documentation or `.env.example` when adding configuration.
- Update Docker files only when runtime or deployment behavior actually changes.
- Keep production compatibility with the Bun version pinned in `Dockerfile` unless the task is specifically an upgrade.

## Completion checklist

Before reporting completion:

1. Review the diff for unrelated changes and leaked secrets.
2. Run the narrowest relevant tests.
3. Run `bun run check`.
4. Run broader unit or integration tests when the change warrants them and the environment supports them.
5. Summarize what changed, which checks ran, and any checks that could not run.
