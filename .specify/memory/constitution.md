# Pantry Pal Constitution

## Core Principles

### I. Offline Single-User Scope

Pantry Pal MUST remain a small, offline, single-user tool. Features and technical decisions MUST preserve a single-user workflow and MUST NOT introduce multi-user collaboration.
Features and technical decisions MUST NOT perform network communication; all workflows MUST operate fully offline.
This invariant protects the product's intentionally narrow scope and keeps pantry data local to
its user.

### II. Simplicity First

Contributors MUST prefer the standard library and a plain file over adding a dependency or service.
Every proposed dependency MUST be justified in the implementation plan, including why simpler
standard-library or file-based alternatives do not meet the requirement. This keeps the tool small
and usable offline.

### III. Testable Core

Business rules MUST be implemented as pure functions: they MUST NOT access the filesystem, clock,
or network. Rules that depend on the current date MUST receive that date as an explicit input.
This makes rule behavior deterministic and directly unit-testable.

### IV. Test-First Business Rules (NON-NEGOTIABLE)

For every new or changed business rule, a test MUST be written first and observed failing before
the implementation is added or changed. The implementation MUST then make that test pass. This
proves that each rule is specified by an executable check rather than retrofitted to existing code.

### V. Data Safety and Honest Errors

Saving pantry data MUST preserve the last valid user file if a write fails or is interrupted; a
partial write MUST NOT corrupt or replace the last valid file. The tool MUST NOT silently swallow
failures. When it cannot complete a requested operation, it MUST explain the failure and exit
with a non-zero status.

## Product Constraints

Pantry data MUST remain available for offline use and MUST have one local user as its owner. Any
storage or write strategy MUST preserve the previous valid data until a complete replacement is
ready. Failures during reading, writing, or processing MUST remain visible to the user; success
MUST NOT be reported when the requested operation did not complete.

## Development Workflow

Plans MUST identify business rules and their tests before implementation. For each new dependency,
the plan MUST record its purpose and why the standard library or a plain file is insufficient.
Changes to persistence MUST include checks for failed or interrupted writes and preservation of
the last valid pantry file. Relevant tests MUST pass before a change is considered complete.

## Governance

This constitution constrains all product and technical decisions. In particular, convenience,
architecture, or dependency choices MUST NOT turn Pantry Pal into an online, multi-user, or
network-dependent product. A technical plan that conflicts with these constraints MUST be revised
or rejected; implementation plans MUST explicitly explain how their choices preserve the
offline, single-user scope and satisfy the applicable principles above.

Amendments MUST be reviewed and approved by the project maintainer, state their rationale and
impact, and update this version and amendment date. Changes MUST be reviewed for compliance with
each applicable principle. Versioning follows semantic versioning: MAJOR for incompatible changes
to principles or governance, MINOR for new principles or materially expanded obligations, and
PATCH for clarifications that do not change obligations.

**Version**: 1.0.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-13
