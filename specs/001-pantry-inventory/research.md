# Research: Pantry Pal CLI

## Decision: Run TypeScript with Node's built-in type stripping

**Decision**: Use Node.js 22.18.0 or newer and execute `.ts` entry points directly with Node. Restrict source to erasable TypeScript syntax, use explicit `.ts` import extensions, and use ESM consistently. Do not add a TypeScript compiler, `tsx`, or another runtime loader.

**Rationale**: Node 22 introduced native type stripping in 22.6.0; Node 22.18.0 enables it by default. This keeps the application runtime within Node's built-in capabilities and honors the requested dependency limit. Vitest and current Commander versions both require Node 22.12.0 or newer, so 22.18.0 satisfies those engine requirements as well.

**Trade-offs and alternatives**: Native stripping removes types but does not type-check, read `tsconfig.json`, support path aliases, or transform enums, runtime namespaces, parameter properties, decorators, and `.tsx`. A compiler or loader would offer broader TypeScript support and static checking but add a package outside the requested dependency set. The plan accepts this limitation and makes focused tests the repeatable correctness gate. Node 22 type stripping is documented as release-candidate/active-development functionality, so the runtime floor must be stated explicitly.

**Sources**:

- https://nodejs.org/docs/latest-v22.x/api/typescript.html
- https://nodejs.org/en/blog/release/v22.18.0

## Decision: Use Commander for the CLI boundary

**Decision**: Use the user-requested `commander` package to declare the Pantry Pal commands, arguments, help text, and usage validation. Keep command callbacks thin and delegate rule decisions to the domain module.

**Rationale**: Commander provides subcommand parsing, generated help, missing-argument checks, and errors for unknown commands/options. Those are the central needs of this small multi-command CLI, and Commander was explicitly requested. No web framework or additional CLI library is needed.

**Trade-offs and alternatives**: Node's standard library could parse `process.argv`, but implementing subcommands, help, and usage errors manually would add bespoke parser behavior. Commander is the one allowed runtime dependency. Current Commander requires Node 22.12.0 or newer.

**Sources**:

- https://github.com/tj/commander.js

## Decision: Use Vitest for tests

**Decision**: Use the user-requested `vitest` package for unit and integration tests. The pure domain suite imports the rules directly; filesystem and CLI boundary suites test adapters separately.

**Rationale**: Vitest provides a maintained test runner and assertions for TypeScript test files, supporting the constitution's test-first requirement without adding a second testing framework. Tests will be run once in CI and locally, not in watch mode for the validation gate.

**Trade-offs and alternatives**: Node's built-in test runner could avoid a test dependency, but Vitest is explicitly requested. Vitest has its own transitive package tree, accepted as part of the user's explicit Vitest choice; no separate assertion or mocking library will be added. Current Vitest requires Node 22.12.0 or newer.

**Sources**:

- https://vitest.dev/guide/

## Decision: Keep pantry persistence in one local JSON file

**Decision**: Store the pantry as JSON at `path.join(os.homedir(), '.pantry-pal', 'pantry.json')`, using only Node's standard `node:fs/promises`, `node:path`, `node:os`, and `node:crypto` modules. Missing data means an empty pantry; malformed or unreadable data is an error and must not be overwritten.

**Rationale**: One local file fits the single-user/offline scope, is inspectable, and avoids introducing a database or service. `crypto.randomUUID()` supplies stable entry IDs so same-name and exact-duplicate entries remain independently addressable.

**Trade-offs and alternatives**: A database would add operational complexity and violate the specified storage choice. Concurrent mutations from separate processes are not given a locking protocol in this initial scope; atomic replacement prevents partial-file writes but does not promise conflict-free concurrent read-modify-write operations.

## Decision: Preserve quantities as exact decimal strings

**Decision**: Accept plain base-10 decimal text at the CLI and persist `quantity` and `minimumQuantity` as canonical decimal strings in JSON. Implement a small pure decimal helper using a `BigInt` coefficient and decimal scale; do not convert pantry amounts to JavaScript `Number`.

**Rationale**: JavaScript numbers use binary floating-point and can produce visible residues during repeated fractional use or make threshold comparisons surprising. `BigInt` is built into the language, so coefficient/scale arithmetic preserves exact decimal values without adding a dependency. The same pure helpers support reductions, minimum comparisons, serialization, and display.

**Trade-offs and alternatives**: JSON numbers are more familiar to generic consumers but cannot preserve every base-10 fraction exactly. A decimal package would reduce custom arithmetic work but violates the selected dependency limit. Tests must cover scale alignment, canonical formatting, repeated use such as `0.3 - 0.1 - 0.1 = 0.1`, and shopping equality at `0.1`.

## Decision: Replace the pantry file through a same-directory temporary file

**Decision**: Serialize the complete new document before I/O. Create a uniquely named temporary sibling with exclusive creation, write all bytes, flush the temporary file, close it, then rename it over `pantry.json`. On any pre-rename failure, report failure and best-effort remove the temporary file; never modify or truncate the current pantry file in place. Report success only after rename succeeds.

**Rationale**: Staging in the destination directory keeps source and destination on the same filesystem. The existing file remains untouched while the new content is produced, and Node documents that rename overwrites an existing destination. This is the simplest standard-library replacement pattern for protecting against a process being interrupted during a write.

**Trade-offs and alternatives**: Direct `writeFile` to the destination can truncate it before the new contents are complete. Copying a temporary file over the target has no atomicity guarantee in Node's documentation. Atomic visibility and power-loss durability are distinct: flushing the temporary file improves durability, but the plan does not claim universal crash durability or identical atomic guarantees for every filesystem. Tests will inject both write and rename failures and verify the prior valid file remains byte-for-byte readable.

**Sources**:

- https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromisesrenameoldpath-newpath
- https://nodejs.org/docs/latest-v22.x/api/fs.html#filehandle-sync
- https://man7.org/linux/man-pages/man2/rename.2.html

## Decision: Keep rules pure and deterministic

**Decision**: Put pantry validation and transformations in a dependency-free domain module. Pass `today` as an ISO date argument to expiry rules. Generate IDs and obtain the local date at the application boundary; pass those values into pure operations rather than reading time, filesystem, or process state in the domain.

**Rationale**: This directly enforces the project constitution and allows each business rule to be unit-tested without storage or subprocesses. Dates are calendar dates, so the CLI derives today's local `YYYY-MM-DD` once per command and the domain compares validated ISO dates and a pure seven-calendar-day boundary.

**Trade-offs and alternatives**: Letting rules call the clock or read the JSON file would couple business behavior to runtime state and make deterministic tests harder. No date/time or schema library is needed.
