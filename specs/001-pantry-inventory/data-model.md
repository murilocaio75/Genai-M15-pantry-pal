# Data Model: Pantry Pal

## Persistence Document

The single pantry file contains one JSON object with an `items` array. Missing file means an empty pantry. Invalid JSON or invalid persisted records are reported as errors; the application does not silently replace them with an empty pantry.

```json
{
  "items": [
    {
      "id": "e15c4a4a-9a60-4d03-a2b1-7e266d6af0b3",
      "name": "Milk",
      "quantity": "1.5",
      "unit": "L",
      "expiryDate": "2026-10-20",
      "minimumQuantity": "0.5"
    }
  ]
}
```

## Pantry Entry

| Field             | Type                     | Rules                                                                                                                                                                                                      |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | string                   | Unique stable ID for independently addressing entries, including exact duplicates. Generated at the application boundary with Node's standard-library UUID support and passed into pure domain operations. |
| `name`            | string                   | Required and non-blank after trimming surrounding whitespace. Preserve case. Equal names do not merge entries.                                                                                             |
| `quantity`        | decimal string           | Exact base-10 value. Positive when added; fractions allowed for every unit; reductions may bring it to zero but never below zero. Persist as a canonical decimal string, never a JSON number.              |
| `unit`            | string                   | Required and non-blank. Preserve the exact label entered. Different labels are distinct; do not normalize synonyms or convert quantities.                                                                  |
| `expiryDate`      | string                   | Required valid calendar date in `YYYY-MM-DD` format; no time-of-day component.                                                                                                                             |
| `minimumQuantity` | decimal string, optional | Exact base-10, non-negative value; may be fractional and uses the entry's unit. Omission means no shopping threshold. Clearing the threshold removes this field.                                           |

## Decimal Representation

Quantities and minimums are accepted as plain base-10 decimal text (digits with an optional decimal point and fractional digits; no exponent notation). Parse the digits into an integer coefficient and decimal scale using built-in `BigInt`; align scales for addition, subtraction, and comparison. Normalize persisted/displayed values by removing unnecessary leading and trailing zeros, with zero represented as `0`. Do not convert values to JavaScript `Number`, impose a unit-specific precision cap, or allow binary floating-point artifacts in persisted values, display, or threshold comparisons.

For example, subtracting `0.1` twice from `0.3` produces exactly `0.1`, and comparison with a minimum of `0.1` includes the entry.

## Derived Views

- **Expired**: `expiryDate` is earlier than the passed-in `today` date.
- **Expiring soon**: `today <= expiryDate <= today + 7 calendar days`, inclusive. Expired entries are not in this group.
- **Shopping list**: Entries with `minimumQuantity` set and `quantity <= minimumQuantity`.

Expiry classification and shopping eligibility are calculated when requested; they are not persisted.

## State Transitions

- Add creates a new independently identified entry. It never merges an existing entry, even when all visible fields match.
- Use subtracts a positive amount no greater than current quantity. A result of zero remains stored.
- Set or change minimum updates only that entry. Clear minimum removes its optional threshold.
- Remove deletes only the entry selected by ID.

## Pure Domain Boundary

The domain module accepts entries, amounts, IDs, and `today` as arguments and returns validated results or domain errors. It does not read the clock, access files, inspect process state, generate IDs, or perform network operations. Filesystem persistence and CLI parsing remain outside this module.
