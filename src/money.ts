export type Line = { amount: number };

/**
 * Number of decimal places of the minor unit ("exponent") for every active
 * ISO 4217 currency whose exponent is not 2 (Table A.1 of ISO 4217,
 * "Currency codes").
 *
 * All currencies not listed here are defined by ISO 4217 with an exponent
 * of exactly 2, so nothing is left on a guessed default.
 */
const ISO_4217_MINOR_UNITS: Record<string, number> = {
  // Exponent 0: no minor unit in circulation.
  BIF: 0, // Burundian franc
  CLP: 0, // Chilean peso
  DJF: 0, // Djiboutian franc
  GNF: 0, // Guinean franc
  ISK: 0, // Icelandic króna
  JPY: 0, // Japanese yen
  KMF: 0, // Comorian franc
  KRW: 0, // South Korean won
  MGA: 0, // Malagasy ariary (subdivided into fifths, not hundredths)
  PYG: 0, // Paraguayan guaraní
  RWF: 0, // Rwandan franc
  UGX: 0, // Ugandan shilling
  UYI: 0, // Uruguay Unidad Indexada (funds code)
  VND: 0, // Vietnamese dong
  VUV: 0, // Vanuatu vatu
  XAF: 0, // Central African CFA franc
  XOF: 0, // West African CFA franc
  XPF: 0, // CFP franc

  // Exponent 3: minor unit is one thousandth of the main unit.
  BHD: 3, // Bahraini dinar
  IQD: 3, // Iraqi dinar
  JOD: 3, // Jordanian dinar
  KWD: 3, // Kuwaiti dinar
  LYD: 3, // Libyan dinar
  OMR: 3, // Omani rial
  TND: 3, // Tunisian dinar

  // Exponent 4: minor unit is one ten-thousandth of the main unit.
  CLF: 4, // Chilean Unidad de Fomento (funds code)
  UYW: 4, // Uruguayan Unidad Previsional (funds code)
};

/** ISO 4217 defines exponent 2 for every currency omitted above. */
const ISO_4217_DEFAULT_MINOR_UNITS = 2;

/**
 * Codes outside ISO 4217 (or unrecognized) have no defined minor unit;
 * fall back to the standard's default exponent of 2.
 */
export function minorUnitExponent(currency: string): number {
  const code = currency.trim().toUpperCase();
  return ISO_4217_MINOR_UNITS[code] ?? ISO_4217_DEFAULT_MINOR_UNITS;
}

/**
 * Round `value` to `exponent` decimal places (round half away from zero)
 * and render it in fixed-point notation.
 *
 * `toFixed` alone is wrong here: it rounds the binary double, so a decimal
 * such as 1.005, stored as 1.0049999..., renders as "1.00". Instead we take
 * String(value), the shortest decimal string that uniquely identifies the
 * double (i.e. the decimal the caller actually wrote), and round that with
 * exact BigInt arithmetic. This also avoids the 1e21 RangeError of toFixed.
 */
function roundToMinorUnit(value: number, exponent: number): string {
  if (!Number.isFinite(value)) return String(value);

  const negative = value < 0;
  const s = String(Math.abs(value));

  // Split scientific notation, e.g. "1.5e21" or "1e-7".
  const eIndex = s.indexOf('e');
  const mantissa = eIndex === -1 ? s : s.slice(0, eIndex);
  const binaryExponent = eIndex === -1 ? 0 : Number(s.slice(eIndex + 1));

  // digits represent the mantissa without the decimal point, so that
  // value = BigInt(digits) * 10^(binaryExponent - fractionLength).
  const dotIndex = mantissa.indexOf('.');
  const fractionLength = dotIndex === -1 ? 0 : mantissa.length - dotIndex - 1;
  const digits = mantissa.replace('.', '');

  // Scale to minor units: value * 10^exponent.
  const shift = binaryExponent - fractionLength + exponent;
  let minorUnits: bigint;
  if (shift >= 0) {
    minorUnits = BigInt(digits) * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const quotient = BigInt(digits) / divisor;
    const remainder = BigInt(digits) % divisor;
    // Round half away from zero (value is non-negative here).
    minorUnits = remainder * 2n >= divisor ? quotient + 1n : quotient;
  }

  const unit = 10n ** BigInt(exponent);
  let out = String(minorUnits / unit);
  if (exponent > 0) {
    out += '.' + String(minorUnits % unit).padStart(exponent, '0');
  }
  return negative && minorUnits !== 0n ? '-' + out : out;
}

export function formatTotal(lines: Line[], currency: string): string {
  const sum = lines.reduce((total, line) => total + line.amount, 0);
  return roundToMinorUnit(sum, minorUnitExponent(currency));
}
