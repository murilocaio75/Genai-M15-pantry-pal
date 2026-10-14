# Feature Specification: Pantry Pal

**Feature Branch**: `001-pantry-inventory`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Build Pantry Pal, a personal kitchen inventory tracker for a single household."

## Clarifications

### Session 2026-10-13

- Q: As quantidades podem incluir frações, como 0,5 kg ou 1,5 L, ou devem aceitar somente números inteiros? → A: Permitir quantidades fracionárias em qualquer unidade.
- Q: Rótulos equivalentes, como “kg” e “quilogramas”, devem ser tratados como a mesma unidade ou como unidades diferentes? → A: Tratar cada rótulo diferente como uma unidade diferente, sem conversão.
- Q: Ao adicionar um alimento cujo nome já existe, o Pantry Pal deve criar uma entrada separada ou combinar com uma existente? → A: Criar sempre uma entrada separada; nunca combinar automaticamente.
- Q: Como definir ou limpar o mínimo de um item sem acrescentar outro comando de topo à CLI? → A: Oferecer essas ações como subcomandos de `shop`; manter somente os seis comandos de topo especificados.
- Q: Valores fracionários devem manter exatidão decimal após usos repetidos e comparações com mínimos? → A: Sim; quantidades e mínimos são valores decimais exatos, sem artefatos de arredondamento binário.

## User Scenarios & Testing

### User Story 1 - Manage Pantry Stock (Priority: P1)

A person records food they have by entering its name, quantity and unit, and expiry date. They can review all recorded entries, reduce a quantity when food is used, and remove an entry when it is no longer needed.

**Why this priority**: Recording and maintaining stock is the essential value of the product. Expiry and shopping views depend on accurate pantry entries.

**Independent Test**: Add an entry, verify it appears with its entered details, reduce its quantity and verify the change, then remove it and verify it no longer appears.

**Acceptance Scenarios**:

1. **Given** the pantry is empty, **When** the person adds an item with a name, positive quantity (including a fractional quantity), unit, and expiry date, **Then** the item appears in the pantry with those details.
2. **Given** an item is in the pantry, **When** the person lists pantry contents, **Then** every recorded item and its quantity, unit, and expiry date are shown.
3. **Given** an item has a quantity greater than zero, **When** the person reduces it by a valid amount (including a fractional amount), **Then** its recorded quantity decreases by that amount and its unit remains unchanged.
4. **Given** an item's quantity has been reduced to zero, **When** the person lists pantry contents, **Then** the zero-quantity entry remains available for minimum-stock tracking until explicitly removed.
5. **Given** an item is in the pantry, **When** the person removes that item, **Then** it no longer appears in the pantry or shopping list.
6. **Given** an item is recorded as 1.5 kg, **When** the person reduces it by 0.5 kg, **Then** its remaining quantity is 1.0 kg.
7. **Given** separate entries use the unit labels “kg” and “quilogramas”, **When** the person views pantry contents, **Then** each entry retains its exact label and quantities are not converted or combined.
8. **Given** an entry exists, **When** the person adds another entry with the same name, unit, and expiry date, **Then** both entries remain separately listed and their quantities are not combined.
9. **Given** an item has 0.3 kg, **When** the person uses 0.1 kg twice, **Then** exactly 0.1 kg remains, without a rounding artifact.

---

### User Story 2 - Review Expiry Dates (Priority: P2)

A person reviews which recorded foods are expired and which are due to expire soon, so they can plan what to use first.

**Why this priority**: Expiry awareness helps prevent food waste, after the user has a way to record their stock.

**Independent Test**: With entries dated before today, today, seven days from today, and eight days from today, verify each appears in the correct expiry group.

**Acceptance Scenarios**:

1. **Given** an item has an expiry date before the current calendar date, **When** the person views expiry information, **Then** the item is identified as expired.
2. **Given** an item expires today or on any of the next seven calendar dates, **When** the person views expiry information, **Then** the item is identified as expiring soon and is not identified as already expired.
3. **Given** an item expires more than seven calendar days from today, **When** the person views expiry information, **Then** it is not identified as expired or expiring soon.

---

### User Story 3 - Build a Shopping List (Priority: P3)

A person sets a minimum quantity for an item and reviews items whose recorded quantity is at or below that minimum.

**Why this priority**: Minimum-stock tracking helps prevent running out, and depends on the pantry records established by the higher-priority workflows.

**Independent Test**: Set minimums on several entries with quantities below, equal to, and above those minimums, plus an entry without a minimum; verify the shopping list contains exactly the eligible entries.

**Acceptance Scenarios**:

1. **Given** an item has a minimum quantity, **When** its recorded quantity is equal to or below that minimum, **Then** it appears on the shopping list with its current quantity, unit, and minimum.
2. **Given** an item has a minimum quantity, **When** its recorded quantity is above that minimum, **Then** it does not appear on the shopping list.
3. **Given** an item has no minimum quantity, **When** the person views the shopping list, **Then** the item does not appear.
4. **Given** the person changes or clears an item's minimum quantity, **When** the person views the shopping list, **Then** eligibility reflects the updated or cleared minimum.

### Edge Cases

- Adding an item with a blank name or unit, a non-positive quantity, or no expiry date is rejected with an explanation; existing pantry data remains unchanged.
- Fractional quantities and minimums are allowed for every unit; units do not impose whole-number-only quantities.
- Fractional quantities and minimums retain exact base-10 values through repeated use, persistence, display, and shopping-list comparisons; binary floating-point rounding artifacts are not shown or used to change eligibility.
- A quantity reduction must be positive and cannot exceed the item's recorded quantity. An invalid reduction is rejected without changing the item.
- A zero-quantity entry remains in the pantry until removed and can appear on the shopping list when its minimum is set above zero.
- An expiry date equal to today is expiring soon, not expired; an expiry date exactly seven days from today is included, and one eight days from today is not.
- Minimum quantities cannot be negative and use the same unit as the corresponding pantry entry. Unit labels are retained exactly as entered; different labels, including synonyms such as “kg” and “quilogramas”, are distinct and are not normalized or converted.
- Entries with the same name may be recorded separately; each entry is managed and evaluated by its own quantity, unit, expiry date, and minimum.
- Adding an entry always creates a separate record, even if its name, unit, and expiry date match an existing entry; entries are never combined automatically.
- Expiry status does not change shopping-list eligibility; that list compares the recorded quantity with its configured minimum.
- If an operation cannot be completed, the person is told it failed; a failed or interrupted save does not damage the last successfully saved pantry data.
- All workflows remain available without network connectivity. The product has no accounts, sharing, photos, barcode scanning, or nutrition data.

## Requirements

### Functional Requirements

- **FR-001**: The product MUST support one user and one household and MUST operate fully offline without network communication.
- **FR-002**: The product MUST allow the person to add a pantry entry with a non-blank name, a positive quantity (including fractional quantities for any unit), a unit, and an expiry date.
- **FR-003**: The product MUST allow the person to view all recorded pantry entries, including each entry's name, quantity, unit, expiry date, and minimum quantity when set.
- **FR-004**: The product MUST allow the person to reduce an entry's quantity by a positive amount, including a fractional amount, no greater than its current quantity; it MUST reject invalid reductions without changing the entry.
- **FR-005**: A pantry entry reduced to zero MUST remain recorded until the person explicitly removes it.
- **FR-006**: The product MUST allow the person to remove a selected pantry entry, after which it is absent from the pantry and shopping list.
- **FR-007**: The product MUST allow the person to set, change, or clear a non-negative minimum quantity, including a fractional minimum, for an entry. The minimum MUST use the entry's unit.
- **FR-008**: The product MUST identify an entry as expired when its expiry date is earlier than the current calendar date.
- **FR-009**: The product MUST identify an entry as expiring soon when its expiry date is from the current calendar date through the date seven calendar days later, inclusive. Entries already expired MUST NOT be classified as expiring soon.
- **FR-010**: The shopping list MUST include every entry with a configured minimum whose recorded quantity is at or below that minimum, and MUST exclude entries above the minimum or without a minimum.
- **FR-011**: The product MUST report failed operations and MUST NOT report success when the requested operation did not complete.
- **FR-012**: A failed or interrupted save MUST leave the last successfully saved pantry data usable and unchanged.
- **FR-013**: The product MUST NOT provide accounts, sharing, photos, barcode scanning, or nutrition data.
- **FR-014**: The product MUST retain unit labels exactly as entered, treat different labels as distinct, and MUST NOT normalize unit synonyms or convert quantities.
- **FR-015**: Every add action MUST create a separate pantry entry and MUST NOT merge it with an existing entry, even when the name, unit, and expiry date match.
- **FR-016**: The product MUST preserve exact base-10 quantity and minimum values through repeated reductions, persistence, display, and shopping-list comparisons; it MUST NOT expose or use binary floating-point rounding artifacts.

### Key Entities

- **Pantry Entry**: One tracked food record, with a name, quantity and unit, expiry date, and optional minimum quantity. Quantities and minimums may be fractional. Each add action creates a separate entry; duplicate names and identical entry details do not cause merging.
- **Shopping List Entry**: A pantry entry whose minimum is set and whose recorded quantity is less than or equal to that minimum. Its displayed information includes current quantity, unit, and minimum.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In acceptance testing, all add, list, reduce, and remove scenarios produce the expected visible pantry state.
- **SC-002**: In boundary testing, expiry dates before today, today, seven days from today, and eight days from today are classified exactly as specified.
- **SC-003**: In acceptance testing, the shopping list contains 100% of entries at or below their configured minimum and none above it or without a minimum.
- **SC-004**: A person can complete each primary workflow with network access unavailable, without creating an account or sharing data.
- **SC-005**: In failure testing, an unsuccessful or interrupted save preserves the last successfully saved pantry data and communicates the failure.
- **SC-006**: Starting from 0.3 kg, two uses of 0.1 kg leave exactly 0.1 kg; an entry at a minimum of 0.1 kg appears on the shopping list without rounding artifacts.

## Assumptions

- Expiry is recorded as a calendar date, without a time of day. The seven-day window includes today and the date seven calendar days after today.
- Quantity values are positive when added and may be fractional for any unit. Quantity reductions are positive, may be fractional, may reach zero, and may not make the recorded quantity negative. Minimum quantities may also be fractional.
- Fractional quantity and minimum values use exact base-10 semantics across storage, arithmetic, and comparisons.
- Units are entered for each entry and retained exactly as entered. Different labels are distinct even when they may be synonyms; automatic normalization and unit conversion are out of scope.
- Minimum quantity is optional. When set, it is non-negative and expressed in the entry's unit; clearing it removes the entry from shopping-list consideration.
- A zero-quantity entry is retained so that a minimum quantity can indicate that it belongs on the shopping list.
- Entries are never merged automatically; adding an exact duplicate creates another separately managed pantry entry.
- Shopping-list eligibility is based on recorded quantity and minimum only; expiry status is shown separately and does not change eligibility.
- Pantry data is retained locally between uses so the single user can continue working offline.
- The six named commands remain the only top-level CLI commands; setting, changing, and clearing shopping minimums are nested under `shop`.
