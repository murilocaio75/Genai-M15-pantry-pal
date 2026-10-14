# Implementation Plan: Pantry Pal

**Branch**: `001-pantry-inventory` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification and user-provided Node.js/TypeScript CLI constraints.

## Summary

Build an offline, single-user pantry CLI with exactly six top-level commands: `add`, `list`, `use`, `remove`, `expiring`, and `shop`. Store entries in one JSON file under the user's home directory. Keep validation and pantry transformations in a dependency-free pure domain module; route file access and Commander parsing through separate boundary modules. Put minimum set/clear operations under `shop` and allow `add --minimum` for initial values.

## Technical Context

**Language/Version**: TypeScript executed directly by Node.js 22.18.0+ using built-in type stripping; ESM and erasable TypeScript syntax only

**Primary Dependencies**: `commander` (runtime CLI parsing); `vitest` (development test runner). No TypeScript compiler, loader, database, or web framework.

**Storage**: Single JSON document at `~/.pantry-pal/pantry.json`, resolved from `os.homedir()`; update by writing and flushing a uniquely named temporary sibling before renaming it over the target.

**Testing**: Vitest. Write pure-domain unit tests first; add file-adapter and CLI-composition tests using temporary storage and injected dependencies.

**Target Platform**: Node.js 22.18.0+ on supported desktop operating systems with a local filesystem.

**Project Type**: Offline command-line application

**Performance Goals**: No numeric latency target. A single-household JSON file should support interactive add, list, use, remove, expiry, and shopping-list operations without a server.

**Constraints**: Fully offline at runtime; one user and household; no account, sharing, photo, barcode, or nutrition features; pure rules receive `today`; exact unit labels, no conversion; exact base-10 quantities and minima; report failures with non-zero exit status; preserve the prior valid pantry file on failed writes.

**Scale/Scope**: One person's household inventory in one local JSON file. No multi-user or concurrent-writer guarantee is introduced.

### Dependency Justifications

- **Commander** is explicitly requested and provides declarative subcommands, generated help, and argument/option validation. This avoids maintaining a custom argument parser; no other runtime package is needed.
- **Vitest** is explicitly requested and supplies the test runner for test-first pure rules and boundary tests. Do not add another assertion, mocking, or coverage package.
- **Node's built-in TypeScript type stripping** avoids an additional compiler or runtime loader and keeps the permitted dependency set. It does not type-check; use erasable syntax and the requested tests as the repeatable validation gate.
- **Node standard library** supplies filesystem, path, home-directory, date, and UUID operations; no database, network client, or persistence package is justified.
- **Built-in `BigInt`** supplies exact coefficient arithmetic for decimal strings without a decimal library dependency.

## Constitution Check

_GATE: Checked before research and re-checked after design._

| Principle / gate           | Status | Plan evidence                                                                                                                                                                        |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline, single-user scope | PASS   | Runtime reads/writes only the local pantry file; no accounts, network calls, sharing, or sync.                                                                                       |
| Simplicity first           | PASS   | Node standard library for storage and dates; Commander and Vitest are specifically requested and justified above; no database, web framework, TypeScript compiler, or extra package. |
| Testable core              | PASS   | `src/domain/pantry.ts` contains pure rules, with `today` and generated IDs passed in as arguments.                                                                                   |
| Test-first business rules  | PASS   | Write and observe failing domain tests before implementing each rule; then implement to green.                                                                                       |
| Data safety                | PASS   | Never write to the target in place; complete a sibling temp file before rename; test pre-rename failures against the previous file.                                                  |
| Honest errors              | PASS   | Boundary errors go to stderr, failed commands return non-zero, and success is printed only after a successful save.                                                                  |

The requested dependencies do not violate the constitution because their purpose and simpler alternatives are recorded above.

## Project Structure

### Documentation (this feature)

```text
specs/001-pantry-inventory/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── cli.md
├── quickstart.md
└── tasks.md              # Created by /speckit-tasks, not /speckit-plan
```

### Source Code (repository root)

```text
package.json
src/
├── cli.ts
├── domain/
│   ├── decimal.ts
│   └── pantry.ts
└── storage/
    └── pantry-file.ts
tests/
├── unit/
│   ├── decimal.test.ts
│   └── pantry.test.ts
└── integration/
  ├── cli.test.ts
  └── pantry-file.test.ts
```

**Structure Decision**: One small Node project. `cli.ts` composes Commander, the pure `domain/pantry.ts` rules, exact decimal operations in `domain/decimal.ts`, and `storage/pantry-file.ts`. Unit tests import only dependency-free domain modules. Integration tests exercise command composition and filesystem behavior with injected dependencies and temporary files. Keep presentation and storage out of the domain modules.

## Complexity Tracking

No constitution violations. The two direct packages are explicitly requested and justified; all other runtime capabilities use Node's standard library.
