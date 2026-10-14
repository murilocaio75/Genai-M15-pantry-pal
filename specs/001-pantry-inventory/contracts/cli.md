# CLI Contract: Pantry Pal

## Program Behavior

- Program name: `pantry-pal`.
- The application is offline and stores data only in `~/.pantry-pal/pantry.json`, resolving `~` through the current user's home directory.
- Successful commands write results to standard output and exit with status `0`.
- Invalid input, unknown IDs, malformed pantry data, and failed file operations produce a human-readable error on standard error and a non-zero exit status. A failed operation is never reported as successful.
- Commander supplies generated help and version output. Unknown commands/options and missing required arguments are usage errors.
- Every `add` creates a new entry and returns its stable ID. Names are not unique keys.
- Unit labels are preserved exactly; no unit normalization or conversion occurs.
- There are exactly six top-level command names: `add`, `list`, `use`, `remove`, `expiring`, and `shop`. Minimum management is nested under `shop`.
- Quantity and minimum arguments use plain base-10 decimal syntax without exponent notation. Values are calculated, persisted, displayed, and compared exactly; JSON stores them as canonical decimal strings.
- Expiry dates are strict calendar dates in `YYYY-MM-DD` form. Runtime `today` is the local calendar date and is passed to pure expiry rules.

## Commands

### Add an Entry

```text
pantry-pal add <name> --quantity <decimal> --unit <label> --expires <YYYY-MM-DD> [--minimum <decimal>]
```

Creates a separate entry. Quantity must be an exact positive decimal; fractional values are valid for every unit. Optional minimum must be an exact non-negative decimal. The result includes the assigned ID and saved entry details.

### List Entries

```text
pantry-pal list
```

Lists all entries with ID, name, quantity, exact unit label, expiry date, and minimum when set. IDs are required to address entries with duplicate names.

### Record Partial Use

```text
pantry-pal use <id> <decimal>
```

Subtracts a positive exact decimal no greater than the current quantity. Fractional amounts are allowed. A zero result remains listed. The entry's unit does not change.

### Review Shopping List and Manage Minimums

```text
pantry-pal shop
pantry-pal shop set-minimum <id> <decimal>
pantry-pal shop clear-minimum <id>
```

With no subcommand, lists entries whose quantity is at or below a configured minimum. `set-minimum` sets or changes an exact non-negative minimum in the entry's existing unit; `clear-minimum` removes it. `add --minimum` may set the initial threshold. These nested operations do not add a seventh top-level command.

### Remove an Entry

```text
pantry-pal remove <id>
```

Removes only the selected ID. Unknown IDs produce an error and do not change the pantry file.

### Review Expiry

```text
pantry-pal expiring
```

Shows expired entries separately from entries expiring soon. Expired means before local today. Expiring soon means today through seven calendar days later, inclusive.

The shopping list shows entries with a minimum set and current quantity less than or equal to that minimum. Expiry status does not alter eligibility.

## Storage Commit Contract

A mutation is successful only after the complete JSON document has been written to a unique temporary sibling and renamed over the pantry file. A write or rename failure leaves the prior pantry file untouched, returns a non-zero status, and reports failure. Temporary-file cleanup is best-effort and does not replace the original failure.
