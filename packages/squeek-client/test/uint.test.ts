import { describe, expect, it } from "vitest";
import { SqueekNumericError, isUintString, toUint, tryUint } from "../src/index.ts";

describe("uint strings", () => {
  it("parses zero and large values without Number", () => {
    expect(toUint("0")).toBe(0n);
    const huge = "12345678901234567890123456789012345678901234567890";
    expect(toUint(huge).toString()).toBe(huge);
    expect(Number.isSafeInteger(Number(huge))).toBe(false);
  });

  it("rejects forms that JSON or Number would quietly accept", () => {
    for (const value of ["", "01", "1.0", "1e2", "-1", "+1", " 1", "1 ", "0x10", "null"]) {
      expect(isUintString(value)).toBe(false);
      expect(() => toUint(value)).toThrow(SqueekNumericError);
    }
  });

  it("tryUint maps null to null and still rejects garbage", () => {
    expect(tryUint(null)).toBeNull();
    expect(tryUint(undefined)).toBeNull();
    expect(tryUint("42")).toBe(42n);
    expect(() => tryUint("")).toThrow(SqueekNumericError);
  });
});
