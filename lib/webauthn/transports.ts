import 'server-only';

import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

const allowedTransports = [
  'usb',
  'nfc',
  'ble',
  'internal',
  'hybrid',
  'smart-card'
] as const;

export const toAuthenticatorTransports = (
  input: unknown
): AuthenticatorTransportFuture[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const allowed = allowedTransports as readonly string[];
  const filtered = input.filter(
    (value): value is AuthenticatorTransportFuture =>
      typeof value === 'string' && allowed.includes(value)
  );

  return filtered.length > 0 ? filtered : undefined;
};
