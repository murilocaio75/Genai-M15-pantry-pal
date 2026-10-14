import { describe, expect, it } from "vitest";
import {
  addPantryEntry,
  classifyExpiry,
  clearMinimum,
  createPantryEntry,
  getShoppingList,
  reduceQuantity,
  removePantryEntry,
  setMinimum,
  validatePantryDocument,
  type PantryDocument,
  type PantryEntryInput,
} from "../../src/domain/pantry.ts";

function entryInput(
  overrides: Partial<PantryEntryInput> = {},
): PantryEntryInput {
  return {
    id: "entry-1",
    name: "Milk",
    quantity: "1.5",
    unit: "L",
    expiryDate: "2026-10-20",
    ...overrides,
  };
}

function pantryWithOneEntry(quantity = "1.5"): PantryDocument {
  return { items: [createPantryEntry(entryInput({ quantity }))] };
}

describe("pure pantry stock rules", () => {
  it("trims names, requires a nonblank name and unit, and preserves the exact unit label", () => {
    expect(
      createPantryEntry(entryInput({ name: "  Milk  ", unit: " L " })),
    ).toMatchObject({ name: "Milk", unit: " L " });
    expect(() => createPantryEntry(entryInput({ name: "   " }))).toThrow();
    expect(() => createPantryEntry(entryInput({ unit: "   " }))).toThrow();
  });

  it("requires a positive exact decimal quantity and a real YYYY-MM-DD date", () => {
    expect(createPantryEntry(entryInput({ quantity: "0.01" })).quantity).toBe(
      "0.01",
    );
    for (const quantity of ["0", "0.0", "-1", "1e2", "NaN"]) {
      expect(() => createPantryEntry(entryInput({ quantity }))).toThrow();
    }
    for (const expiryDate of ["2026-2-01", "2026-02-30", "20-02-2026"]) {
      expect(() => createPantryEntry(entryInput({ expiryDate }))).toThrow();
    }
  });

  it("creates separate entries for duplicate names and identical details", () => {
    const first = entryInput({ id: "entry-1" });
    const second = entryInput({ id: "entry-2" });
    const pantry = addPantryEntry(addPantryEntry({ items: [] }, first), second);

    expect(pantry.items).toHaveLength(2);
    expect(pantry.items.map((entry) => entry.id)).toEqual([
      "entry-1",
      "entry-2",
    ]);
    expect(pantry.items[0]).toEqual(
      pantry.items[1] && { ...pantry.items[1], id: "entry-1" },
    );
  });

  it("reduces fractional quantities exactly and retains zero entries", () => {
    const entry = createPantryEntry(entryInput({ quantity: "0.3" }));
    const afterFirstUse = reduceQuantity(entry, "0.1");
    const afterSecondUse = reduceQuantity(afterFirstUse, "0.1");

    expect(afterFirstUse.quantity).toBe("0.2");
    expect(afterSecondUse.quantity).toBe("0.1");
    expect(
      reduceQuantity(createPantryEntry(entryInput({ quantity: "1" })), "1")
        .quantity,
    ).toBe("0");
  });

  it("rejects invalid or excessive use without mutating the entry", () => {
    const entry = createPantryEntry(entryInput({ quantity: "0.3" }));

    expect(() => reduceQuantity(entry, "0")).toThrow();
    expect(() => reduceQuantity(entry, "1e-1")).toThrow();
    expect(() => reduceQuantity(entry, "0.4")).toThrow();
    expect(entry.quantity).toBe("0.3");
  });

  it("removes only the requested ID and rejects unknown IDs", () => {
    const pantry = addPantryEntry(
      addPantryEntry({ items: [] }, entryInput({ id: "entry-1" })),
      entryInput({ id: "entry-2" }),
    );

    expect(
      removePantryEntry(pantry, "entry-1").items.map((entry) => entry.id),
    ).toEqual(["entry-2"]);
    expect(() => removePantryEntry(pantry, "missing")).toThrow();
    expect(pantry.items).toHaveLength(2);
  });

  it("validates the persisted pantry document shape and exact decimal strings", () => {
    expect(validatePantryDocument(pantryWithOneEntry("1.5"))).toEqual(
      pantryWithOneEntry("1.5"),
    );
    expect(() =>
      validatePantryDocument({ items: [{ id: "entry-1", quantity: 1.5 }] }),
    ).toThrow();
    expect(() => validatePantryDocument({ items: "not-an-array" })).toThrow();
  });

  it("classifies dates before today as expired", () => {
    expect(classifyExpiry("2026-10-12", "2026-10-13")).toBe("expired");
  });

  it("includes today and exactly seven calendar days in expiring soon", () => {
    expect(classifyExpiry("2026-10-13", "2026-10-13")).toBe("expiring-soon");
    expect(classifyExpiry("2026-10-20", "2026-10-13")).toBe("expiring-soon");
    expect(classifyExpiry("2026-10-21", "2026-10-13")).toBe(
      "not-expiring-soon",
    );
  });

  it("handles month, year, and leap-day boundaries", () => {
    expect(classifyExpiry("2025-01-01", "2024-12-30")).toBe("expiring-soon");
    expect(classifyExpiry("2024-03-05", "2024-02-27")).toBe("expiring-soon");
    expect(classifyExpiry("2024-02-29", "2024-02-28")).toBe("expiring-soon");
  });

  it("requires today to be a valid calendar date and does not read the clock", () => {
    expect(() => classifyExpiry("2026-10-20", "2026-02-30")).toThrow();
  });

  it("sets, changes, and clears exact non-negative minimums", () => {
    const pantry = pantryWithOneEntry("0.3");
    const withMinimum = setMinimum(pantry, "entry-1", "0.20");
    const changedMinimum = setMinimum(withMinimum, "entry-1", "0.4");

    expect(withMinimum.items[0].minimumQuantity).toBe("0.2");
    expect(changedMinimum.items[0].minimumQuantity).toBe("0.4");
    expect(clearMinimum(changedMinimum, "entry-1").items[0]).not.toHaveProperty(
      "minimumQuantity",
    );
    expect(pantry.items[0]).not.toHaveProperty("minimumQuantity");
  });

  it("rejects negative or malformed minimum values without mutation", () => {
    const pantry = pantryWithOneEntry("0.3");

    expect(() => setMinimum(pantry, "entry-1", "-0.1")).toThrow();
    expect(() => setMinimum(pantry, "entry-1", "1e-1")).toThrow();
    expect(pantry.items[0]).not.toHaveProperty("minimumQuantity");
  });

  it("lists exact-unit entries at or below their minimum only", () => {
    const pantry = {
      items: [
        createPantryEntry(
          entryInput({
            id: "below",
            quantity: "0.2",
            minimumQuantity: "0.3",
            unit: "kg",
          }),
        ),
        createPantryEntry(
          entryInput({
            id: "equal",
            quantity: "0.3",
            minimumQuantity: "0.30",
            unit: "quilogramas",
          }),
        ),
        createPantryEntry(
          entryInput({
            id: "above",
            quantity: "0.4",
            minimumQuantity: "0.3",
            unit: "L",
          }),
        ),
        createPantryEntry(entryInput({ id: "unset", quantity: "0.1" })),
        createPantryEntry(
          entryInput({
            id: "zero",
            quantity: "1",
            minimumQuantity: "1",
            unit: "item",
          }),
        ),
      ],
    };
    const zeroStockPantry = {
      items: pantry.items.map((entry) =>
        entry.id === "zero" ? { ...entry, quantity: "0" } : entry,
      ),
    };

    expect(getShoppingList(zeroStockPantry).map((entry) => entry.id)).toEqual([
      "below",
      "equal",
      "zero",
    ]);
  });

  it("updates and clears a minimum only for the selected entry ID", () => {
    const pantry = addPantryEntry(
      addPantryEntry({ items: [] }, entryInput({ id: "entry-1" })),
      entryInput({ id: "entry-2" }),
    );
    const updated = setMinimum(pantry, "entry-2", "0.25");

    expect(updated.items[0]).not.toHaveProperty("minimumQuantity");
    expect(updated.items[1].minimumQuantity).toBe("0.25");
    expect(clearMinimum(updated, "entry-2").items[0]).toEqual(updated.items[0]);
    expect(() => setMinimum(pantry, "missing", "0.1")).toThrow();
    expect(() => clearMinimum(pantry, "missing")).toThrow();
  });
});
