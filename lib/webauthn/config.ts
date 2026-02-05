import 'server-only';

type RpConfig = {
  rpID: string;
  origin: string;
  rpName: string;
};

const getEnvRpConfig = (): RpConfig | null => {
  const rpID = process.env.WEBAUTHN_RP_ID;
  const origin = process.env.WEBAUTHN_ORIGIN;
  const rpName = process.env.WEBAUTHN_RP_NAME ?? 'Acoru Memo';

  if (!rpID || !origin) {
    return null;
  }

  return { rpID, origin, rpName };
};

const canDeriveRpConfig = () =>
  process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';

export const getRpConfig = (request: Request): RpConfig => {
  const envConfig = getEnvRpConfig();
  if (envConfig) {
    return envConfig;
  }

  if (!canDeriveRpConfig()) {
    throw new Error('Missing WebAuthn RP configuration.');
  }

  const host = request.headers.get('host');
  if (!host) {
    throw new Error('Missing Host header for WebAuthn.');
  }

  const originHeader = request.headers.get('origin');
  const protocol = originHeader?.startsWith('https://') ? 'https' : 'http';
  const origin = originHeader ?? `${protocol}://${host}`;
  const rpID = host.split(':')[0];

  return {
    rpID,
    origin,
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Acoru Memo'
  };
};
