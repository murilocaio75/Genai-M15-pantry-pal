# Pantry Pal Project Memory

Last updated: 2026-10-13
Purpose: Handoff for any agent/session resuming implementation without relying on chat history.

## Resume Here

- Current feature: `specs/001-pantry-inventory/`.
- Current phase: US1-US3, final validation, and convergence task T019 are complete.
- Completed task IDs: T001-T019. No tasks remain pending in `tasks.md`.
- Do not restart implementation phases without a concrete defect or a new user request.

## Product Scope

Pantry Pal is a small, offline, single-user household pantry tracker. The six top-level user commands are `add`, `list`, `use`, `remove`, `expiring`, and `shop`. The Commander-generated `help` and `--version` are standard CLI behavior, not additional product workflows.

Explicitly out of scope: accounts, multi-user support, sharing, network communication, synchronization, photos, barcode scanning, nutrition data, database servers, and web frameworks.

## Decisions To Preserve

- **Expiry**: Dates are real calendar dates in `YYYY-MM-DD`, without a time. `today` is passed into the pure expiry rule. An expiry before today is `expired`; today through today plus seven calendar days, inclusive, is `expiring-soon`; later dates are not soon.
- **Quantities**: Fractional amounts are valid for all unit labels. Use exact base-10 decimal strings in JSON and a pure `BigInt` coefficient/scale helper; never convert pantry amounts to JavaScript `Number`. Example: `0.3 - 0.1 - 0.1 = 0.1` exactly.
- **Units**: Preserve exact labels. No synonym normalization or conversion; `kg` and `quilogramas` are distinct.
- **Duplicates**: Each add creates a separate entry. IDs, not names, identify entries for use/removal.
- **Zero stock**: A quantity reduced to `0` remains stored until explicitly removed and can be listed.
- **Shopping thresholds**: Minimum quantity is optional, exact decimal, non-negative, and in that entry's exact unit. Items at or below the minimum qualify; expiry does not affect eligibility. Minimum set/clear are nested under `shop` so the six top-level command names remain unchanged. `add --minimum` may set an initial threshold.
- **Persistence**: One local JSON file at `path.join(os.homedir(), '.pantry-pal', 'pantry.json')`. Save by serializing first, writing/flushing a unique sibling temp file with exclusive creation, closing it, then renaming it over the target. A temp-write or rename failure must leave the previous valid target byte-for-byte intact, report the error, return non-zero, and best-effort clean the temp. Do not claim universal power-loss durability or conflict-free concurrent writers.
- **File permissions**: On POSIX, restrict `.pantry-pal` to `0700` and pantry/temp files to `0600`, including existing directories. On Windows, preserve the ACL inherited from the current user's profile; protection depends on that profile ACL and is documented in README.
- **Domain boundary**: Business rules are pure and dependency-free: no filesystem, clock, process state, or network. Generate IDs and derive local today in the CLI boundary and pass values into domain functions.
- **Errors**: No swallowed failures. Print successful mutation output only after persistence succeeds; errors go to stderr and return non-zero.

## Technical Constraints

- TypeScript ESM, run directly through Node's built-in type stripping. Minimum runtime: Node `22.18.0`.
- Use only Node standard library plus `commander` and `vitest` as direct dependencies. No TypeScript compiler/loader, decimal library, database, or web framework was approved.
- Native stripping does not type-check and ignores `tsconfig` features. Keep TypeScript syntax erasable, use explicit `.ts` relative import extensions and `import type`, avoid enums/runtime namespaces/parameter properties/decorators/`.tsx`/path aliases.
- Do not add `@types/node` unless the user changes the dependency restriction. Editor diagnostics may report missing Node declarations even though runtime tests pass.
- Dependency installation may need network; application runtime itself must never access the network.

## Project Layout And Important Files

- `package.json`: ESM package; `engines.node >=22.18.0`; `pantry-pal` bin points to `src/cli.ts`; scripts `start` and `test` (`vitest run`); direct runtime dependency `commander`; direct dev dependency `vitest`.
- `src/cli.ts`: Commander factory with injectable home, ID generation, filesystem operations, clock date, stdout, and stderr. Six top-level commands: `add`, `list`, `use`, `remove`, `expiring`, and `shop`; `shop` contains `set-minimum` and `clear-minimum` subcommands.
- `src/domain/decimal.ts`: exact decimal parsing, `BigInt` coefficient/scale arithmetic, comparison, and canonical formatting.
- `src/domain/pantry.ts`: pure entry creation/validation, exact quantity reduction, ID-targeted removal, persisted document validation, `classifyExpiry(expiryDate, today)`, minimum set/clear, and shopping-list selection.
- `src/storage/pantry-file.ts`: JSON file loading/saving, missing-file-as-empty, shape validation through domain rules, sibling temp write, flush, rename, cleanup/error handling, and platform-aware private permissions.
- `tests/unit/decimal.test.ts`: exact decimal unit tests.
- `tests/unit/pantry.test.ts`: stock/domain, expiry boundaries, minimum mutation, and shopping-list selection tests.
- `tests/integration/pantry-file.test.ts`: storage failure tests plus POSIX owner-only mode and Windows home-path/ACL behavior checks.
- `tests/integration/cli.test.ts`: US1, US2, and US3 CLI tests with injected `today`, storage, output, and temporary homes.
- `README.md`: installation, command reference, offline behavior, exact decimal representation, and data-safety overview.
- `specs/001-pantry-inventory/spec.md`: authoritative requirements and clarifications.
- `specs/001-pantry-inventory/plan.md`, `data-model.md`, `contracts/cli.md`, `research.md`, `quickstart.md`: design artifacts.
- `specs/001-pantry-inventory/tasks.md`: task status; update only tasks actually completed.
- `specs/001-pantry-inventory/checklists/requirements.md`: requirements-quality checklist, all 16/16 checked; it is not an implementation checklist and must not be changed by implementation.
- `memory.md`: this handoff; keep it updated as later stories finish.

## Implemented Behavior

### US1 (T001-T008)

- `add <name> --quantity <decimal> --unit <label> --expires <date> [--minimum <decimal>]`: creates a unique entry and persists it.
- `list`: displays the pantry entries.
- `use <id> <decimal>`: subtracts exactly; rejects non-positive/excessive use; retains zero.
- `remove <id>`: removes one ID only.
- Unknown IDs, invalid data, and storage failures return errors/non-zero. Mutation success prints only after the save.

### US2 (T009-T012)

- `expiring`: loads pantry, obtains local today from the CLI boundary (injectable in tests), and emits JSON with separate `expired` and `expiringSoon` arrays.
- Pure `classifyExpiry` validates both date arguments and computes calendar increments manually; it does not read the clock.

### US3 (T013-T016)

- `shop` lists entries whose exact quantity is less than or equal to a configured minimum; entries without a minimum are excluded.
- `shop set-minimum <id> <decimal>` sets or changes a minimum; `shop clear-minimum <id>` removes it. Both operate on one ID and preserve the entry's unit label.
- `add --minimum <decimal>` sets an initial threshold at entry creation.
- Pure rules use the exact `BigInt` decimal helper. Expiry status does not affect shopping-list eligibility.

### Convergence T019

- POSIX pantry directory permissions are `0700`; temporary and final pantry files are `0600`.
- Windows leaves inherited ACLs unchanged and keeps the pantry below the user's home/profile directory; README documents that security depends on the profile ACL.

## Current Task Status

| Tasks     | Status   | Notes                                                               |
| --------- | -------- | ------------------------------------------------------------------- |
| T001-T002 | Complete | Package and CLI bootstrap; Node 24.15.0 runtime verified.           |
| T003-T004 | Complete | Six persistence tests pass, including write/rename fault injection. |
| T005-T006 | Complete | Exact-decimal and pure stock rules.                                 |
| T007-T008 | Complete | Add/list/use/remove CLI.                                            |
| T009-T010 | Complete | Pure expiry/date boundaries, including calendar rollover.           |
| T011-T012 | Complete | `expiring` CLI with deterministic injected today.                   |
| T013-T014 | Complete | Exact minimum rules and shopping-list selector.                     |
| T015-T016 | Complete | `shop` and nested set/clear minimum operations.                     |
| T017      | Complete | README documents installation, commands, offline use, and storage.  |
| T018      | Complete | Full suite and isolated end-to-end CLI smoke test.                  |

## Last Verified State

- Environment: Windows PowerShell; Node `v24.15.0`; npm `11.12.1`.
- `npm test`: **4 test files passed, 37 tests passed** after T019.
- `npm run start -- --help`: shows the six top-level commands, including `shop`.
- `npm run start -- shop --help`: shows `set-minimum` and `clear-minimum` subcommands.
- An isolated `USERPROFILE` smoke run exercised add/list/use/remove/expiring/shop/set-minimum/clear-minimum, including the day-seven boundary; the temporary directory was removed and the real pantry was not accessed.
- Permission tests passed on the Windows host: they assert the POSIX chmod requests and confirm pantry storage remains under the supplied home path for inherited Windows ACLs. Actual POSIX `stat` mode assertions run on POSIX hosts.
- Pylance/editor can report unresolved Node built-ins (`node:crypto`, `node:os`, `node:url`, `process`) because Node type declarations are intentionally not installed. Runtime tests and Node type stripping work; do not add an unapproved dependency just to silence those diagnostics.
- **Git (2026-10-13)**: the workspace was converted into a Git repository (`git init -b main`). A `.gitignore` was added (`node_modules/`, `*.log`, `.env`, `.DS_Store`, `coverage/`). Initial commit `c1ca376` ("feat: initial Pantry Pal CLI from Spec Kit workshop") contains all source, tests, specs, `.specify/`, `.github/skills/`, README and this file. Remote `origin` is the public repo https://github.com/murilocaio75/Genai-M15-pantry-pal (created with `gh`, branch `main` pushed).
- `.specify/extensions.yml` was absent; no Spec Kit hooks were configured.

## Future Continuation

1. All tasks T001-T019 are complete. Start future work only from a new explicit user request or a reproducible defect.
2. Re-read any affected files before editing; user edits or formatting may occur between sessions.

Useful commands from repo root:

```powershell
npm test
npm test -- tests/unit/pantry.test.ts
npm test -- tests/integration/cli.test.ts
npm run start -- --help
npm run start -- shop --help
```
