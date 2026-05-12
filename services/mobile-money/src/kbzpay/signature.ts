import crypto from 'crypto';

/**
 * KBZ Pay signature: SHA256 of all non-sign params sorted alphabetically,
 * formatted as key=value& pairs, then appended with &key=<signKey>.
 */
export function buildSignature(params: Record<string, string>, signKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const payload = `${sorted}&key=${signKey}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toUpperCase();
}

export function verifySignature(params: Record<string, string>, signKey: string): boolean {
  const received = params['sign'];
  if (!received) return false;
  const expected = buildSignature(params, signKey);
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
