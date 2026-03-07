export function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isAllDigits(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function isbn10Checksum(isbn10: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(isbn10)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = isbn10[i]!;
    const digit = char === "X" ? 10 : Number(char);
    sum += digit * (10 - i);
  }

  return sum % 11 === 0;
}

function isbn13Checksum(isbn13: string): boolean {
  if (!isAllDigits(isbn13)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(isbn13[i]!);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(isbn13[12]!);
}

export function isValidIsbn(value: string): boolean {
  const normalized = normalizeIsbn(value);

  if (normalized.length === 10) {
    return isbn10Checksum(normalized);
  }

  if (normalized.length === 13) {
    return isbn13Checksum(normalized);
  }

  return false;
}
