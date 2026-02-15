export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateReferralCode(name?: string): string {
  const prefix = name ? name.substring(0, 4).toUpperCase() : 'USER';
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}