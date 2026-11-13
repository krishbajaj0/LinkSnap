import { once } from 'node:events';
import { createApp } from './app.js';
import { readConfig } from './config/env.js';
import { connectMongo, disconnectMongo } from './database/mongo.js';

async function start() {
  const config = readConfig();
  if (config.mongoUri) await connectMongo(config.mongoUri);

  const server = createApp(config).listen(config.port, config.host);
  try {
    await once(server, 'listening');
  } catch {
    throw new Error('HTTP listener failed to start. Check HOST and PORT.');
  }
  console.info(`LinkSnap API listening on ${config.host}:${config.port}.`);
  if (!config.mongoUri) console.info('MongoDB is unconfigured. Only liveness is available.');

  async function shutdown() {
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    } catch {
      console.error('HTTP shutdown failed.');
      process.exitCode = 1;
    } finally {
      await closeDatabase();
      clearTimeout(deadline);
    }
  }

  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    void shutdown();
  }

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

async function closeDatabase() {
  try {
    await disconnectMongo();
  } catch {
    console.error('MongoDB shutdown failed.');
    process.exitCode = 1;
  }
}

try {
  await start();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  await closeDatabase();
}
