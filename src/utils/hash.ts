const crypto = require('node:crypto');

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned;
}

export function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export interface UserData {
  em?: string;
  ph?: string;
  lead_id?: string;
  [key: string]: string | undefined;
}

export function hashUserData(email?: string, phone?: string): UserData {
  const data: UserData = {};
  if (email) data.em = sha256(normalizeEmail(email));
  if (phone) data.ph = sha256(normalizePhone(phone));
  return data;
}
