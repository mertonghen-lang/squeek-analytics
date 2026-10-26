import { SqueekNumericError } from "./errors";

/**
 * Decimal string for an unsigned integer. API fields that count work, block units,
 * round ids, base units, or chain block numbers use this shape. Parse them with
 * {@link toUint}; never with `Number`.
 */
export type UintString = string;

const UINT = /^(0|[1-9]\d*)$/;

export function isUintString(value: string): boolean {
  return UINT.test(value);
}

/** Parse a canonical unsigned decimal string into a bigint. Rejects signs, fractions, exponents, and leading zeros. */
export function toUint(value: string): bigint {
  if (!isUintString(value)) {
    throw new SqueekNumericError(
      `Expected an unsigned decimal string, received ${JSON.stringify(value)}`,
    );
  }
  return BigInt(value);
}

export function tryUint(value: string | null | undefined): bigint | null {
  if (value == null) return null;
  return toUint(value);
}
