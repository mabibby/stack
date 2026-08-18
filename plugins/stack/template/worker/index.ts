import { registerHandlers } from "@/lib/jobs/handlers";
import { createBoss } from "@/lib/jobs/queue";
import { logger } from "@/lib/observability/logger";

/**
 * Background worker — a separate long-running process (2nd Railway service,
 * `bun run dev:worker` locally). Owns its own pg-boss instance, registers all
 * handlers, and shuts down gracefully so in-flight jobs finish.
 * Scheduled jobs go here too, e.g.  await boss.schedule(QUEUES.X, "0 3 * * *");
 */
const main = async (): Promise<void> => {
  const boss = createBoss();
  boss.on("error", (err: unknown) => logger.error({ err }, "worker.pgboss.error"));

  await boss.start();
  await registerHandlers(boss);
  logger.info("worker.ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker.shutdown");
    try {
      await boss.stop({ graceful: true, close: true, timeout: 30_000 });
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "worker.shutdown.failed");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

main().catch((err) => {
  logger.error({ err }, "worker.fatal");
  process.exit(1);
});
