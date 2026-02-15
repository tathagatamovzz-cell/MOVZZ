export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return /^[6-9]/.test(digits);
  }
  
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]/.test(digits.substring(2));
  }
  
  return false;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  
  return phone;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{2})\d{6}(\d{4})/, '$1******$2');
}