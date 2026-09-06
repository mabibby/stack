#!/usr/bin/env bun
/**
 * `bun run dev` — runs the web app AND the background worker together, in one
 * terminal, with prefixed output. Ctrl+C stops both. If either one dies, both
 * stop, so a broken worker is never silently missing.
 *
 * Run them separately with `bun run dev:web` / `bun run dev:worker`.
 */
import { type ChildProcess, spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";

type Proc = { name: string; child: ChildProcess };
const procs: Proc[] = [];
let stopping = false;

const prefixed = (name: string, from: Readable | null, to: Writable) => {
  if (!from) return;
  let buffer = "";
  from.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) to.write(`${name} │ ${line}\n`);
  });
  from.on("end", () => {
    if (buffer) to.write(`${name} │ ${buffer}\n`);
  });
};

const stopAll = (exitCode: number) => {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.child.exitCode === null) p.child.kill("SIGTERM");
  const forceAt = setTimeout(() => {
    for (const p of procs) if (p.child.exitCode === null) p.child.kill("SIGKILL");
    process.exit(exitCode);
  }, 5000);
  forceAt.unref();
  Promise.all(
    procs.map(
      (p) =>
        new Promise<void>((resolve) => {
          if (p.child.exitCode !== null) return resolve();
          p.child.once("exit", () => resolve());
        }),
    ),
  ).then(() => process.exit(exitCode));
};

const start = (name: string, cmd: string, args: string[]) => {
  const child = spawn(cmd, args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
  });
  prefixed(name, child.stdout, process.stdout);
  prefixed(name, child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `\n${name} stopped (${signal ?? `exit ${code}`}) — stopping everything. Fix the error above, then run \`bun run dev\` again.`,
    );
    stopAll(code ?? 1);
  });
  procs.push({ name, child });
};

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

start("web   ", "bun", ["run", "dev:web"]);
start("worker", "bun", ["run", "dev:worker"]);
