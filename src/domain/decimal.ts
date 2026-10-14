export interface DecimalValue {
  readonly coefficient: bigint;
  readonly scale: number;
}

function validateScale(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    throw new Error("Decimal scale must be a non-negative safe integer.");
  }
}

function alignScales(
  left: DecimalValue,
  right: DecimalValue,
): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * 10n ** BigInt(scale - left.scale);
  const rightCoefficient =
    right.coefficient * 10n ** BigInt(scale - right.scale);
  return [leftCoefficient, rightCoefficient, scale];
}

export function parseDecimal(value: string): DecimalValue {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [wholePart, fractionalPart = ""] = value.split(".");
  const coefficient = BigInt(`${wholePart}${fractionalPart}`);
  return { coefficient, scale: fractionalPart.length };
}

export function formatDecimal(value: DecimalValue): string {
  validateScale(value.scale);
  if (value.coefficient < 0n) {
    throw new Error("Decimal coefficient cannot be negative.");
  }
  if (value.coefficient === 0n) {
    return "0";
  }

  const digits = value.coefficient.toString();
  if (value.scale === 0) {
    return digits;
  }

  const paddedDigits = digits.padStart(value.scale + 1, "0");
  const wholePart = paddedDigits.slice(0, -value.scale) || "0";
  const fractionalPart = paddedDigits.slice(-value.scale).replace(/0+$/, "");
  return fractionalPart.length === 0
    ? wholePart
    : `${wholePart}.${fractionalPart}`;
}

export function addDecimal(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = alignScales(
    parseDecimal(left),
    parseDecimal(right),
  );
  return formatDecimal({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  });
}

export function subtractDecimal(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = alignScales(
    parseDecimal(left),
    parseDecimal(right),
  );
  const coefficient = leftCoefficient - rightCoefficient;
  if (coefficient < 0n) {
    throw new Error("Decimal subtraction cannot produce a negative quantity.");
  }
  return formatDecimal({ coefficient, scale });
}

export function compareDecimal(left: string, right: string): -1 | 0 | 1 {
  const [leftCoefficient, rightCoefficient] = alignScales(
    parseDecimal(left),
    parseDecimal(right),
  );
  if (leftCoefficient < rightCoefficient) {
    return -1;
  }
  if (leftCoefficient > rightCoefficient) {
    return 1;
  }
  return 0;
}
