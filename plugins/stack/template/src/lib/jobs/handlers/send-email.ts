import type { PgBoss } from "pg-boss";
import { sendEmail } from "@/lib/email/send";
import { QUEUES, type SendEmailJob } from "@/lib/jobs/queues";
import { logger } from "@/lib/observability/logger";

/**
 * One job per call (batchSize 1): if the handler throws, pg-boss fails and retries the WHOLE batch,
 * so a batch of emails would re-send the ones that already went out. Batch only with
 * `perJobResults: true`, which settles each job on its own.
 */
export const registerSendEmailHandler = async (boss: PgBoss): Promise<void> => {
  await boss.work<SendEmailJob>(QUEUES.SEND_EMAIL, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      logger.info({ jobId: job.id, to: job.data.to }, "job.email.send.start");
      await sendEmail(job.data);
    }
  });
};
