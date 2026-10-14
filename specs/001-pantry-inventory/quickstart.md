# Quickstart: Pantry Pal Validation

## Prerequisites

- Node.js 22.18.0 or newer. The minimum supports native TypeScript type stripping without an added compiler or loader dependency.
- npm for installing the explicitly selected development/runtime packages.

Dependency installation may require network access. After installation, Pantry Pal's runtime workflows use no network connection.

## Install and Verify

From the repository root:

```sh
npm install
npm test
npm run start -- --help
```

Expected results:

- Dependency installation completes with only Commander and Vitest as direct dependencies.
- `npm test` runs the unit and integration suites once and exits zero when they pass.
- Help lists exactly the six top-level commands `add`, `list`, `use`, `remove`, `expiring`, and `shop`; `shop` help also lists its minimum-management subcommands.

## Acceptance Validation

The automated integration tests use a temporary home directory and isolated pantry file; they do not read or modify the developer's real `~/.pantry-pal/pantry.json`.

1. Add two entries with the same name, unit, and expiry date. Confirm they receive different IDs and remain separate in `list`.
2. Reduce an entry from `1.5 kg` by `0.5 kg`. Confirm its quantity becomes exactly `1 kg`; reject a reduction larger than the remaining amount and confirm the file is unchanged.
3. Reduce an entry from `0.3 kg` by `0.1 kg` twice. Confirm exactly `0.1 kg` remains; with a minimum of `0.1 kg`, confirm it appears in `shop` without rounding artifacts.
4. Use `shop set-minimum <id> <decimal>` and `shop clear-minimum <id>`; confirm `shop` includes entries at or below a configured minimum and excludes entries above it or with no minimum.
5. Supply a fixed `today` to the pure domain tests. Confirm dates before today are expired, today and day seven are expiring soon, and day eight is neither.
6. Inject failures during temp-file writing and during rename. Confirm the previous pantry file remains byte-for-byte readable, the command reports failure, and no success result is emitted.
7. Run the command suite and filesystem tests with network access disabled. Confirm no command attempts a network operation.

The domain tests call pure functions directly with explicit dates and no filesystem or subprocess. Integration tests exercise the CLI command composition and file adapter with injected dependencies and temporary paths.
