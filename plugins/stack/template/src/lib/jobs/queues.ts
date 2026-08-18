/**
 * Queue names + payload types in ONE place so the producer (web) and the
 * consumer (worker) can't drift. Never hardcode a queue string elsewhere.
 * Adding a job: add a constant + payload type here, a handler in ./handlers,
 * register it in ./handlers/index.ts.
 */
export const QUEUES = {
  SEND_EMAIL: "email.send",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type SendEmailJob = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type JobPayloads = {
  [QUEUES.SEND_EMAIL]: SendEmailJob;
};
