export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('55')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length > 11) {
    cleaned = cleaned.slice(cleaned.length - 11);
  }
  return '55' + cleaned;
}

export function normalizeDigits(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\D/g, '');
}
