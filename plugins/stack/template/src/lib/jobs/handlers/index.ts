import type { PgBoss } from "pg-boss";
import { QUEUES } from "@/lib/jobs/queues";
import { registerSendEmailHandler } from "./send-email";

/** Register every job handler. Called once by worker/index.ts. */
export const registerHandlers = async (boss: PgBoss): Promise<void> => {
  for (const queue of Object.values(QUEUES)) await boss.createQueue(queue);
  await registerSendEmailHandler(boss);
};
