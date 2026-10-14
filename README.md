# Pantry Pal

Offline, single-user pantry inventory for one household. Pantry data stays in one local JSON file at `~/.pantry-pal/pantry.json`; the application does not use network services.

On POSIX systems, the pantry directory is restricted to the owner (`0700`) and pantry/temp files to the owner (`0600`). On Windows, Node relies on the ACL inherited from the current user's profile directory; access protection depends on that profile ACL.

On POSIX systems, the pantry directory is restricted to the owner (`0700`) and pantry/temp files to the owner (`0600`). On Windows, Node relies on the ACL inherited from the current user's profile directory; access protection depends on that profile ACL.

## Requirements

- Node.js 22.18.0 or newer
- npm

Node runs the TypeScript entry point using built-in type stripping. This project intentionally has no TypeScript compiler or runtime loader; Node strips types but does not type-check source.

## Install and Test

```sh
npm install
npm test
```

Dependency installation may require network access. Pantry Pal commands do not.

For local development, run commands with `npm run start -- <command>`.

## Commands

There are six top-level commands: `add`, `list`, `use`, `remove`, `expiring`, and `shop`.

```text
pantry-pal add <name> --quantity <decimal> --unit <label> --expires <YYYY-MM-DD> [--minimum <decimal>]
pantry-pal list
pantry-pal use <id> <decimal>
pantry-pal remove <id>
pantry-pal expiring
pantry-pal shop
pantry-pal shop set-minimum <id> <decimal>
pantry-pal shop clear-minimum <id>
```

`add` always creates a separate entry and prints its ID. Use that ID with `use`, `remove`, and the `shop` minimum subcommands. Quantity and minimum values use exact base-10 decimals; exponent notation is not accepted. Unit labels are preserved exactly and are never converted or normalized.

`expiring` reports expired entries separately from entries expiring today through seven calendar days later, inclusive. `shop` lists entries whose configured minimum is greater than or equal to the current quantity; use its nested subcommands to set/change or clear an item's minimum.

Invalid input or failed storage operations are reported on stderr with a non-zero exit status. Pantry updates are written to a temporary sibling file and renamed into place only after the complete new JSON has been written, so a failed write or rename leaves the previous pantry file intact.
