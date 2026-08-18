import type { PgBoss } from "pg-boss";
import { sendEmail } from "@/lib/email/send";
import { QUEUES, type SendEmailJob } from "@/lib/jobs/queues";
import { logger } from "@/lib/observability/logger";

export const registerSendEmailHandler = async (boss: PgBoss): Promise<void> => {
  await boss.work<SendEmailJob>(QUEUES.SEND_EMAIL, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      logger.info({ jobId: job.id, to: job.data.to }, "job.email.send.start");
      await sendEmail(job.data);
    }
  });
};
