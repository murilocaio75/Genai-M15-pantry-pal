---
description: "Implementation tasks for Pantry Pal"
---

# Tasks: Pantry Pal

**Input**: Design documents from `specs/001-pantry-inventory/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md

**Tests**: Required by the project constitution. Every business-rule test must be written and observed failing before its implementation task. Persistence tests also precede the file-adapter implementation.

**Organization**: Tasks are grouped by user story so each increment can be tested and demonstrated independently after its prerequisites.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable only when tasks touch different files and have no unfinished dependencies.
- **[Story]**: User story mapping from `spec.md`: US1 stock, US2 expiry, US3 shopping list.
- Every task names its target file.

## Phase 1: Setup

**Purpose**: Establish the Node.js TypeScript CLI project and test command.

- [x] T001 [P] Create `package.json` with ESM mode, `engines.node` set to `>=22.18.0`, `pantry-pal` bin at `src/cli.ts`, `start` script using `node src/cli.ts`, `test` script using `vitest run`, `commander` as the only direct runtime dependency, and `vitest` as the only direct development dependency.
- [x] T002 [P] Create `src/cli.ts` as the Node 22 native-TypeScript entry point with `#!/usr/bin/env node`, a minimal Commander program factory that accepts injected application dependencies, and a main entry guard.

---

## Phase 2: Foundational

**Purpose**: Establish and validate the one-file persistence boundary before any story depends on it.

- [x] T003 Write and run failing persistence tests in `tests/integration/pantry-file.test.ts` for missing-file-as-empty, exact decimal-string JSON round-trip, malformed JSON error without overwrite, successful replacement, injected temp-write failure, and injected rename failure; both failures must leave the existing pantry file byte-for-byte unchanged, report failure, and clean up the temp file when possible.
- [x] T004 Implement `src/storage/pantry-file.ts` using `os.homedir()` and the exact path `~/.pantry-pal/pantry.json`; create the directory as needed; write a uniquely named sibling temp file with exclusive creation; write and flush complete serialized JSON; close before rename; rename over the destination only after the temp is complete; report write or rename errors and best-effort clean the temp without altering the previous file.

**Checkpoint**: Storage round-trip and failure tests pass; no story writes directly to the destination file.

---

## Phase 3: User Story 1 - Manage Pantry Stock (Priority: P1) MVP

**Goal**: Add, list, use, and remove separately addressable pantry entries with exact units and fractional quantities.

**Independent Test**: Add two exact duplicate entries and verify distinct IDs; list both; reduce one from 1.5 kg by 0.5 kg; verify 1.0 kg; reject invalid reductions without mutation; remove one ID and verify the other remains.

### Tests for User Story 1

- [x] T005 [US1] Write and run failing exact-decimal tests in `tests/unit/decimal.test.ts` and pure-domain tests in `tests/unit/pantry.test.ts` for base-10 parsing, scale-aligned arithmetic/comparison, canonical formatting, `0.3 - 0.1 - 0.1 = 0.1`, entry validation, nonblank trimmed names and units, strict ISO calendar dates, exact unit-label preservation, duplicate IDs, invalid/excessive use, zero retention, ID-targeted removal, and persisted document shape; domain calls receive IDs explicitly and perform no I/O or clock reads.

### Implementation for User Story 1

- [x] T006 [US1] Implement exact decimal parsing, scale-aligned arithmetic/comparison, and canonical formatting with `BigInt` in `src/domain/decimal.ts`; implement pure entry creation, persisted-document validation, quantity reduction, zero retention, and ID-targeted removal in `src/domain/pantry.ts`; never convert quantities to `Number`, perform I/O, read the clock, or access process/network state; make T005 pass.
- [x] T007 [US1] Write and run failing CLI composition tests in `tests/integration/cli.test.ts` for `add`, `list`, `use`, and `remove`, including required/invalid decimal arguments, duplicate names, exact repeated fractional use and display, unknown IDs, stderr/non-zero failures, no success before save, and isolated injected home/storage dependencies.
- [x] T008 [US1] Implement Commander registration and handlers for `add`, `list`, `use`, and `remove` in `src/cli.ts`; generate IDs at the CLI boundary, pass decimal text into pure domain functions, persist canonical decimal strings through `pantry-file.ts`, preserve exact unit labels, print success only after save, and return non-zero for failures; make T007 pass.

**Checkpoint**: The P1 stock workflow is independently demonstrable with the JSON file and all P1 tests passing.

---

## Phase 4: User Story 2 - Review Expiry Dates (Priority: P2)

**Goal**: Separate expired entries from entries expiring today through seven calendar days later, inclusive.

**Independent Test**: With a fixed `today`, classify entries dated yesterday, today, day seven, and day eight; verify the two groups and ensure expired entries never appear in expiring soon.

### Tests for User Story 2

- [x] T009 [US2] Write and run failing pure-domain boundary tests in `tests/unit/pantry.test.ts` for expiry before `today`, exactly `today`, exactly seven calendar days after `today`, eight days after `today`, leap-day/year boundaries, and ensuring `today` is an explicit function argument.

### Implementation for User Story 2

- [x] T010 [US2] Implement pure expired and expiring-soon classification in `src/domain/pantry.ts` using strict `YYYY-MM-DD` calendar dates and the inclusive range `today` through `today + 7 calendar days`; exclude expired entries from expiring soon and make T009 pass.
- [x] T011 [US2] Write and run failing `expiring` command tests in `tests/integration/cli.test.ts` for separate expired/soon output, fixed injected local `today`, boundary entries, empty groups, and error status on unreadable pantry data.
- [x] T012 [US2] Register `pantry-pal expiring` in `src/cli.ts`; derive local `today` once at the CLI boundary, pass it into pure rules, display expired and soon groups separately without converting units, and make T011 pass.

**Checkpoint**: Expiry output is deterministic under tests and matches the date boundaries in the specification.

---

## Phase 5: User Story 3 - Build a Shopping List (Priority: P3)

**Goal**: Set, change, or clear an entry's minimum and list entries at or below that minimum.

**Independent Test**: Set fractional minima on entries below, at, and above thresholds and on a zero-quantity entry; verify `shop` includes exactly entries with a configured minimum and quantity less than or equal to it, then clear a minimum and verify exclusion.

### Tests for User Story 3

- [x] T013 [US3] Write and run failing pure-domain tests in `tests/unit/pantry.test.ts` for setting, changing, and clearing exact non-negative decimal minimums; reject negative or malformed decimal text; match only the entry's exact unit label; include quantity equal to or below minimum after exact comparison; exclude above-minimum and unset-minimum entries; include zero quantity when its minimum is positive; ignore expiry status.

### Implementation for User Story 3

- [x] T014 [US3] Implement pure minimum updates/clearing and shopping-list selection in `src/domain/pantry.ts`, using exact decimal helpers from `src/domain/decimal.ts`, comparing quantities only within the entry's exact unit label and ignoring expiry status; make T013 pass.
- [x] T015 [US3] Write and run failing CLI tests in `tests/integration/cli.test.ts` for `shop set-minimum <id> <decimal>`, `shop clear-minimum <id>`, initial `add --minimum`, exact threshold equality, and `shop` output/empty results/error statuses.
- [x] T016 [US3] Register `shop` listing and its `set-minimum` and `clear-minimum` subcommands in `src/cli.ts`; keep the six specified top-level command names, allow optional `add --minimum`, pass decimal text without Number conversion, show exact quantity/unit/minimum for eligible entries, and make T015 pass.

**Checkpoint**: The shopping list includes exactly entries whose current quantity is at or below a configured minimum.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Document supported use and verify the integrated feature against its full contract.

- [x] T017 [P] Document Node 22.18+ prerequisites, the six top-level commands and nested `shop` minimum operations, local JSON location, offline runtime behavior, exact decimal/date boundaries, and failure behavior in `README.md`.
- [x] T018 Run `npm test` and the quickstart smoke checks from the repository root; verify `node src/cli.ts --help`, the six top-level commands and nested `shop` minimum operations, exact repeated-decimal behavior, expected stdout/stderr and exit codes, no network access during runtime, and injected write/rename failure coverage from `tests/integration/pantry-file.test.ts`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately; T001 and T002 define the package and CLI entrypoint before runtime/test tasks.
- **Foundational (Phase 2)**: Depends on Phase 1; T003 must fail before T004 implements persistence. Blocks all user-story phases.
- **User Story 1 (Phase 3)**: Depends on foundational persistence. Within the story, T005 fails before T006; T007 fails before T008.
- **User Story 2 (Phase 4)**: Depends on US1 entries and CLI. T009 fails before T010; T011 fails before T012.
- **User Story 3 (Phase 5)**: Depends on US1 entry storage and CLI. T013 fails before T014; T015 fails before T016. Minimum set/clear operations remain subcommands of `shop`, not new top-level commands.
- **Polish (Phase 6)**: Depends on all three stories.

### User Story Dependencies

- **US1 (P1)**: Starts after foundational storage; delivers a usable stock-tracking MVP.
- **US2 (P2)**: Starts after US1 provides pantry entries and list command; expiry rules remain independently unit-testable with constructed entries.
- **US3 (P3)**: Starts after US1 provides stored entries; threshold and shopping rules remain independently unit-testable with constructed entries.

### Parallel Opportunities

- T001 and T002 can be prepared in parallel because they touch different files, then run after both are complete.
- P1 domain tests (T005) and storage setup tests (T003) touch separate files but belong to sequential phases; do not start story implementation until foundational storage (T004) is complete.
- Story test tasks precede their corresponding implementations and share test files within the story, so test and implementation tasks are not parallel.
- T017 documentation can run in parallel with final verification after all stories are complete; T018 must wait for the full implementation.

## Parallel Example: Setup

```text
Task: T001 Configure package.json scripts, engines, and permitted dependencies.
Task: T002 Create the injected Commander entrypoint in src/cli.ts.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Complete US1 tests first, observe failure, then implement the domain and CLI stock commands.
3. Validate add/list/use/remove independently with an isolated pantry file.
4. Stop at the P1 checkpoint for a usable stock-only MVP.

### Incremental Delivery

1. Deliver US1 stock tracking.
2. Add US2 expiry awareness and verify fixed-date boundaries.
3. Add US3 minimum management and shopping list.
4. Run the full quickstart and atomic-write failure tests.

## Notes

- Every task uses `- [ ] Tnnn`, with `[P]` only where tasks are genuinely independent and `[USn]` on story-phase tasks.
- The project constitution requires test-first development for every business rule; each domain test task explicitly requires observing failures before implementation.
- Node's native TypeScript stripping does not type-check. Keep to erasable syntax, explicit `.ts` imports, and ESM; do not add a compiler or loader dependency.
- Minimum set/change/clear operations are nested under `shop` to honor the six-command top-level interface while fulfilling FR-007.
- Exact decimal values are represented as canonical strings in JSON and manipulated with the dependency-free `BigInt` decimal helper; never round through JavaScript `Number`.

## Phase 7: Convergence

- [x] T019 Protect personal pantry data from other local users in `src/storage/pantry-file.ts`: create the storage directory and temporary/final JSON files with owner-only permissions (`0700` directory, `0600` files) on POSIX; on Windows rely only on and document inherited `USERPROFILE` ACLs, and add platform-specific permission/location tests in `tests/integration/pantry-file.test.ts` per Constitution II (contradicts, CRITICAL).
