import { PgBoss, type SendOptions } from "pg-boss";
import { env } from "@/lib/env";
import { type JobPayloads, QUEUES, type QueueName } from "@/lib/jobs/queues";
import { logger } from "@/lib/observability/logger";

/**
 * pg-boss lives in the same Postgres (schema `pgboss`) — no Redis, no extra
 * service. The web app only ENQUEUES; the worker process (worker/index.ts)
 * consumes. Both call `createBoss()`.
 */
export const createBoss = (): PgBoss =>
  new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: "pgboss",
    application_name: "app",
    monitorIntervalSeconds: 10,
  });

const globalForBoss = globalThis as unknown as { pgBoss?: Promise<PgBoss> };

/** Lazily-started producer instance for the web side (cached across HMR). */
export const getBoss = (): Promise<PgBoss> => {
  if (!globalForBoss.pgBoss) {
    globalForBoss.pgBoss = (async () => {
      const boss = createBoss();
      boss.on("error", (err: unknown) => logger.error({ err }, "pgboss.error"));
      await boss.start();
      for (const queue of Object.values(QUEUES)) await boss.createQueue(queue);
      logger.info("pgboss.started.producer");
      return boss;
    })();
  }
  return globalForBoss.pgBoss;
};

/** Type-safe enqueue. `await enqueue(QUEUES.SEND_EMAIL, { to, subject, html, text })` */
export const enqueue = async <Q extends QueueName>(
  queue: Q,
  payload: JobPayloads[Q],
  options?: SendOptions,
): Promise<string | null> => {
  const boss = await getBoss();
  const jobId = await boss.send(queue, payload, { retryLimit: 3, retryBackoff: true, ...options });
  logger.debug({ queue, jobId }, "job.enqueued");
  return jobId;
};
