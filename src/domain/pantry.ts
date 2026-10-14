import {
  compareDecimal,
  formatDecimal,
  parseDecimal,
  subtractDecimal,
} from "./decimal.ts";

export interface PantryEntry {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  minimumQuantity?: string;
}

export interface PantryDocument {
  items: PantryEntry[];
}

export interface PantryEntryInput {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  minimumQuantity?: string;
}

export type ExpiryClassification =
  | "expired"
  | "expiring-soon"
  | "not-expiring-soon";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function addCalendarDays(date: string, days: number): string {
  if (!isValidCalendarDate(date)) {
    throw new Error("Date must be a real calendar date in YYYY-MM-DD format.");
  }
  const [yearText, monthText, dayText] = date.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText);

  for (let index = 0; index < days; index += 1) {
    day += 1;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
        if (year > 9999) {
          throw new Error("Date range exceeds YYYY-MM-DD format.");
        }
      }
    }
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function classifyExpiry(
  expiryDate: string,
  today: string,
): ExpiryClassification {
  if (!isValidCalendarDate(today)) {
    throw new Error("Today must be a real calendar date in YYYY-MM-DD format.");
  }
  if (!isValidCalendarDate(expiryDate)) {
    throw new Error(
      "Expiry date must be a real calendar date in YYYY-MM-DD format.",
    );
  }
  if (expiryDate < today) {
    return "expired";
  }
  return expiryDate <= addCalendarDays(today, 7)
    ? "expiring-soon"
    : "not-expiring-soon";
}

function canonicalPositiveDecimal(value: string, fieldName: string): string {
  const canonical = formatDecimal(parseDecimal(value));
  if (compareDecimal(canonical, "0") <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
  return canonical;
}

function canonicalNonNegativeDecimal(value: string, fieldName: string): string {
  try {
    return formatDecimal(parseDecimal(value));
  } catch (error) {
    throw new Error(`${fieldName} must be a non-negative decimal.`, {
      cause: error,
    });
  }
}

export function createPantryEntry(input: PantryEntryInput): PantryEntry {
  const id = input.id.trim();
  const name = input.name.trim();
  if (id.length === 0) {
    throw new Error("Entry ID must not be blank.");
  }
  if (name.length === 0) {
    throw new Error("Item name must not be blank.");
  }
  if (input.unit.trim().length === 0) {
    throw new Error("Unit label must not be blank.");
  }
  if (!isValidCalendarDate(input.expiryDate)) {
    throw new Error(
      "Expiry date must be a real calendar date in YYYY-MM-DD format.",
    );
  }

  const entry: PantryEntry = {
    id,
    name,
    quantity: canonicalPositiveDecimal(input.quantity, "Quantity"),
    unit: input.unit,
    expiryDate: input.expiryDate,
  };

  if (input.minimumQuantity !== undefined) {
    entry.minimumQuantity = canonicalNonNegativeDecimal(
      input.minimumQuantity,
      "Minimum quantity",
    );
  }

  return entry;
}

export function addPantryEntry(
  pantry: PantryDocument,
  input: PantryEntryInput,
): PantryDocument {
  const entry = createPantryEntry(input);
  if (pantry.items.some((existingEntry) => existingEntry.id === entry.id)) {
    throw new Error(`An item with ID '${entry.id}' already exists.`);
  }
  return { items: [...pantry.items, entry] };
}

export function reduceQuantity(
  entry: PantryEntry,
  amount: string,
): PantryEntry {
  const canonicalAmount = canonicalPositiveDecimal(amount, "Use amount");
  if (compareDecimal(canonicalAmount, entry.quantity) > 0) {
    throw new Error("Use amount cannot exceed the current quantity.");
  }
  return {
    ...entry,
    quantity: subtractDecimal(entry.quantity, canonicalAmount),
  };
}

export function removePantryEntry(
  pantry: PantryDocument,
  id: string,
): PantryDocument {
  const index = pantry.items.findIndex((entry) => entry.id === id);
  if (index < 0) {
    throw new Error(`No pantry entry exists with ID '${id}'.`);
  }
  return { items: pantry.items.filter((entry) => entry.id !== id) };
}

export function setMinimum(
  pantry: PantryDocument,
  id: string,
  minimumQuantity: string,
): PantryDocument {
  const entryIndex = pantry.items.findIndex((entry) => entry.id === id);
  if (entryIndex < 0) {
    throw new Error(`No pantry entry exists with ID '${id}'.`);
  }

  const canonicalMinimum = canonicalNonNegativeDecimal(
    minimumQuantity,
    "Minimum quantity",
  );
  return {
    items: pantry.items.map((entry, index) =>
      index === entryIndex
        ? { ...entry, minimumQuantity: canonicalMinimum }
        : entry,
    ),
  };
}

export function clearMinimum(
  pantry: PantryDocument,
  id: string,
): PantryDocument {
  const entryIndex = pantry.items.findIndex((entry) => entry.id === id);
  if (entryIndex < 0) {
    throw new Error(`No pantry entry exists with ID '${id}'.`);
  }

  return {
    items: pantry.items.map((entry, index) => {
      if (index !== entryIndex) {
        return entry;
      }
      const { minimumQuantity: _minimumQuantity, ...entryWithoutMinimum } =
        entry;
      return entryWithoutMinimum;
    }),
  };
}

export function getShoppingList(pantry: PantryDocument): PantryEntry[] {
  return pantry.items.filter(
    (entry) =>
      entry.minimumQuantity !== undefined &&
      compareDecimal(entry.quantity, entry.minimumQuantity) <= 0,
  );
}

export function validatePantryDocument(value: unknown): PantryDocument {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Pantry document must contain an items array.");
  }

  const items = value.items.map((item): PantryEntry => {
    if (!isRecord(item)) {
      throw new Error("Every pantry item must be an object.");
    }
    const { id, name, quantity, unit, expiryDate, minimumQuantity } = item;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof quantity !== "string" ||
      typeof unit !== "string" ||
      typeof expiryDate !== "string" ||
      (minimumQuantity !== undefined && typeof minimumQuantity !== "string")
    ) {
      throw new Error(
        "Pantry item fields must use the documented string formats.",
      );
    }

    return createPantryEntry({
      id,
      name,
      quantity,
      unit,
      expiryDate,
      ...(minimumQuantity === undefined ? {} : { minimumQuantity }),
    });
  });

  const ids = new Set<string>();
  for (const entry of items) {
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate pantry entry ID '${entry.id}'.`);
    }
    ids.add(entry.id);
  }

  return { items };
}
