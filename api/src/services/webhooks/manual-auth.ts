import * as crypto from 'crypto';

const SIGNATURE_PREFIX = 'sha256=';

export function verifyManualWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret?: string,
): boolean {
  if (!webhookSecret || !signature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const suppliedDigest = signature.slice(SIGNATURE_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedDigest)) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  const supplied = Buffer.from(suppliedDigest, 'hex');
  const expected = Buffer.from(expectedDigest, 'hex');

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}
