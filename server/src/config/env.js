const developmentOrigins = 'http://localhost:5173,http://127.0.0.1:5173';

export function readConfig(env = process.env) {
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const mongoUri = env.MONGODB_URI?.trim();
  if (environment === 'production' && !mongoUri) {
    throw new Error('MONGODB_URI is required in production.');
  }
  if (mongoUri && !/^mongodb(?:\+srv)?:\/\/[^\s/]/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string.');
  }

  const defaultOrigins = environment === 'production' ? '' : developmentOrigins;
  const clientOrigins = new Set(
    (env.CLIENT_ORIGINS ?? defaultOrigins).split(',').map((origin) => origin.trim()).filter(Boolean),
  );
  for (const origin of clientOrigins) {
    const url = URL.parse(origin);
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CLIENT_ORIGINS must contain HTTP(S) origins without paths or trailing slashes.');
    }
  }

  const host = env.HOST?.trim() || (environment === 'production' ? '0.0.0.0' : '127.0.0.1');
  return { environment, host, port, mongoUri, clientOrigins };
}
