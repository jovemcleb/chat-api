import { app, initialize } from "./app";
import { validateEnv } from "./utils/validateEnv";

const start = async () => {
  validateEnv();
  await initialize();

  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info(`Server listening on ${app.server.address()}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
