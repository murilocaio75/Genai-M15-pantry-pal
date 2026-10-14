import { describe, expect, it } from "vitest";
import {
  addDecimal,
  compareDecimal,
  formatDecimal,
  parseDecimal,
  subtractDecimal,
} from "../../src/domain/decimal.ts";

describe("exact decimal arithmetic", () => {
  it("normalizes decimal strings without binary floating-point conversion", () => {
    expect(formatDecimal(parseDecimal("0001.200"))).toBe("1.2");
    expect(formatDecimal(parseDecimal("0.000"))).toBe("0");
    expect(formatDecimal(parseDecimal("25"))).toBe("25");
  });

  it("rejects signs, exponent notation, and malformed decimals", () => {
    for (const value of ["-1", "+1", "1e-1", ".1", "1.", "1.2.3", ""]) {
      expect(() => parseDecimal(value)).toThrow();
    }
  });

  it("adds and compares decimals with different scales exactly", () => {
    expect(addDecimal("0.1", "0.20")).toBe("0.3");
    expect(compareDecimal("0.10", "0.1")).toBe(0);
    expect(compareDecimal("0.09", "0.1")).toBe(-1);
    expect(compareDecimal("12.01", "12")).toBe(1);
  });

  it("subtracts repeated fractions without rounding artifacts", () => {
    expect(subtractDecimal("0.3", "0.1")).toBe("0.2");
    expect(subtractDecimal("0.2", "0.1")).toBe("0.1");
    expect(subtractDecimal("1.5", "0.5")).toBe("1");
  });

  it("rejects subtraction below zero", () => {
    expect(() => subtractDecimal("0.1", "0.2")).toThrow();
  });
});
