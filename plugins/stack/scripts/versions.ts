#!/usr/bin/env bun
/**
 * Is this stack project on the latest stable everything? Compares against the live registries:
 *   - every dependency in package.json (via `bun outdated`: stable releases only, and it honours
 *     bunfig's minimumReleaseAge)
 * Nothing younger than the release-age cooldown (bunfig `minimumReleaseAge`, default 3 days) is
 * suggested: freshly published releases are where compromised packages live.
 *   - Bun (packageManager, Dockerfile, this Mac) and Node (Dockerfile + this Mac vs newest LTS)
 *   - Docker images in docker-compose.yml (newest stable tag of the same shape; removed images)
 *   - GitHub Actions in .github/workflows/*.yml (newest release major)
 *   - the stack plugin itself (vs GitHub)
 *
 *   bun versions.ts            full report (always fresh)
 *   bun versions.ts --hook     SessionStart hook: only inside stack projects; injects the session rules
 *                              (references/session-rules.md + voice.md) and the cached version report
 *   bun versions.ts --dir <p>  check another folder (e.g. the template itself)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const hook = args.includes("--hook");
const dirArg = args.indexOf("--dir");
const dir = resolve(dirArg >= 0 ? (args[dirArg + 1] ?? ".") : ".");
const PLUGIN_ROOT = resolve(dirname(import.meta.path), "..");
const REMOTE_PLUGIN_JSON =
  "https://raw.githubusercontent.com/mabibby/stack/main/plugins/stack/.claude-plugin/plugin.json";
const CACHE_HOURS = 6;
const WATCHED = [
  "package.json",
  "bun.lock",
  "docker-compose.yml",
  "Dockerfile",
  ".github/workflows/ci.yml",
];

// Same cooldown as bunfig.toml [install] minimumReleaseAge (seconds), so we never suggest what bun won't install.
const COOLDOWN_S = Number(
  (read0("bunfig.toml") ?? "").match(/minimumReleaseAge\s*=\s*(\d+)/)?.[1] ?? 259200,
);
function read0(p: string): string | null {
  try {
    return readFileSync(join(dir, p), "utf8");
  } catch {
    return null;
  }
}
const oldEnough = (iso?: string): boolean =>
  !!iso && Date.now() - new Date(iso).getTime() >= COOLDOWN_S * 1000;

// Images that no longer exist upstream → what replaces them.
const REMOVED_IMAGES: Record<string, string> = {
  "minio/minio": "removed from Docker Hub (Sept 2026) — migrate to RustFS (see /stack:upgrade)",
  "minio/mc": "removed from Docker Hub (Sept 2026) — bucket setup is scripts/storage-setup.ts now",
};

const read = read0;

const isStackProject = (read("AGENTS.md") ?? "").includes("created from the **stack** template");
if (hook && !isStackProject) process.exit(0);

// ---------- cache (hook mode only reads it) --------------------------------------------------
const cacheDir = join(process.env.STACK_HOME ?? join(homedir(), ".stack"), "cache", "versions");
const cacheFile = join(
  cacheDir,
  `${createHash("sha1").update(dir).digest("hex").slice(0, 16)}.txt`,
);
const cacheFresh = (): boolean => {
  if (!existsSync(cacheFile)) return false;
  const at = statSync(cacheFile).mtimeMs;
  if (Date.now() - at > CACHE_HOURS * 3600_000) return false;
  return WATCHED.every((f) => !existsSync(join(dir, f)) || statSync(join(dir, f)).mtimeMs < at);
};

// ---------- helpers --------------------------------------------------------------------------
const getJson = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};
const parts = (v: string): number[] => (v.match(/\d+/g) ?? []).map(Number);
const cmp = (a: string, b: string): number => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
};
/** Breaking by semver: major differs, or 0.x minor differs. */
const isMajor = (from: string, to: string): boolean => {
  const [a = 0, b = 0] = parts(from);
  const [c = 0, d = 0] = parts(to);
  return a !== c || (a === 0 && b !== d);
};

// ---------- npm packages ---------------------------------------------------------------------
type Pkg = {
  name: string;
  dev: boolean;
  current: string;
  latest: string;
  repo?: string;
};
const installedVersion = (name: string, range: string): string => {
  const own = read(`node_modules/${name}/package.json`);
  if (own) return (JSON.parse(own) as { version: string }).version;
  const lock = read("bun.lock") ?? "";
  const esc = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const m = lock.match(new RegExp(`"${esc}": \\["${esc}@([^"]+)"`));
  return m?.[1] ?? range.replace(/^[^\d]*/, "");
};

const repoUrl = async (name: string): Promise<string | undefined> => {
  const meta = await getJson<{ repository?: { url?: string } | string }>(
    `https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`,
  );
  const raw = typeof meta?.repository === "string" ? meta.repository : meta?.repository?.url;
  return raw
    ?.replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://");
};

/** `bun outdated` knows the lockfile, stable-only "latest", and the release-age cooldown. */
const bunOutdated = (): Pkg[] | null => {
  if (!existsSync(join(dir, "node_modules"))) return null;
  const r = spawnSync("bun", ["outdated", "--no-progress"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (r.status !== 0 || !r.stdout.includes("| Package")) return r.status === 0 ? [] : null;
  const rows: Pkg[] = [];
  for (const line of r.stdout.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    const [, rawName, current, , rawLatest] = cells;
    if (!rawName || rawName === "Package" || !current || !rawLatest || rawName.startsWith("-"))
      continue;
    const latest = rawLatest.replace(/\s*\*$/, "");
    if (cmp(latest, current) <= 0) continue;
    rows.push({
      name: rawName.replace(/ \(dev\)$/, ""),
      dev: rawName.endsWith("(dev)"),
      current,
      latest,
    });
  }
  return rows;
};

const checkPackages = async (): Promise<{ pkgs: Pkg[]; failed: string[] }> => {
  const viaBun = bunOutdated();
  if (viaBun) {
    await Promise.all(
      viaBun
        .filter((p) => isMajor(p.current, p.latest))
        .map(async (p) => (p.repo = await repoUrl(p.name))),
    );
    return { pkgs: viaBun, failed: [] };
  }
  // No node_modules (e.g. the template itself): ask the registry. No release-age info here.
  const pj = JSON.parse(read("package.json") ?? "{}") as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const entries = [
    ...Object.entries(pj.dependencies ?? {}).map(([n, r]) => ({
      n,
      r,
      dev: false,
    })),
    ...Object.entries(pj.devDependencies ?? {}).map(([n, r]) => ({
      n,
      r,
      dev: true,
    })),
  ].filter(({ r }) => !/^(workspace|file|link|git|github|https?):/.test(r));
  const failed: string[] = [];
  const pkgs = await Promise.all(
    entries.map(async ({ n, r, dev }) => {
      const meta = await getJson<{
        version: string;
        repository?: { url?: string } | string;
      }>(`https://registry.npmjs.org/${n.replace("/", "%2F")}/latest`);
      if (!meta) {
        failed.push(n);
        return null;
      }
      const repoRaw = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
      const repo = repoRaw
        ?.replace(/^git\+/, "")
        .replace(/\.git$/, "")
        .replace(/^git:\/\//, "https://");
      return {
        name: n,
        dev,
        current: installedVersion(n, r),
        latest: meta.version,
        repo,
      };
    }),
  );
  return {
    pkgs: pkgs.filter((p): p is Pkg => p !== null && cmp(p.latest, p.current) > 0),
    failed,
  };
};

// ---------- runtimes ---------------------------------------------------------------------------
const checkRuntimes = async (): Promise<string[]> => {
  const out: string[] = [];
  const [bunRel, nodeIndex] = await Promise.all([
    getJson<{ tag_name: string; published_at: string }>(
      "https://api.github.com/repos/oven-sh/bun/releases/latest",
    ),
    getJson<{ version: string; lts: string | false; date: string }[]>(
      "https://nodejs.org/dist/index.json",
    ),
  ]);
  const bunMeta =
    bunRel && oldEnough(bunRel.published_at)
      ? { version: bunRel.tag_name.replace(/^bun-v/, "") }
      : null;
  const dockerfile = read("Dockerfile") ?? "";
  if (bunMeta) {
    const latest = bunMeta.version;
    const pm = (read("package.json") ?? "").match(/"packageManager":\s*"bun@([^"]+)"/)?.[1];
    const img = dockerfile.match(/oven\/bun:([\d.]+)/)?.[1];
    if (pm && cmp(latest, pm) > 0)
      out.push(`Bun in package.json "packageManager": ${pm} → ${latest}`);
    if (img && cmp(latest, img) > 0) out.push(`Bun in Dockerfile (oven/bun): ${img} → ${latest}`);
    if (cmp(latest, Bun.version) > 0)
      out.push(`Bun on this Mac: ${Bun.version} → ${latest}  (brew upgrade oven-sh/bun/bun)`);
  }
  const lts = nodeIndex?.find((r) => r.lts && oldEnough(r.date));
  if (lts) {
    const ltsMajor = parts(lts.version)[0] ?? 0;
    const img = dockerfile.match(/FROM node:(\d+)/)?.[1];
    if (img && Number(img) < ltsMajor)
      out.push(`Node in Dockerfile: ${img} → ${ltsMajor} (newest LTS, ${lts.version})`);
    const local = spawnSync("node", ["--version"], {
      encoding: "utf8",
    }).stdout?.trim();
    if (local && (parts(local)[0] ?? 0) < ltsMajor)
      out.push(`Node on this Mac: ${local} → ${ltsMajor} LTS  (brew upgrade node)`);
  }
  return out;
};

// ---------- docker images ----------------------------------------------------------------------
const checkImages = async (): Promise<string[]> => {
  const compose = read("docker-compose.yml") ?? "";
  const images = [...compose.matchAll(/^\s*image:\s*["']?([^\s"']+)/gm)].map((m) => m[1] as string);
  const out = await Promise.all(
    images.map(async (image) => {
      const [repo = image, tag = "latest"] = image.split(":");
      if (REMOVED_IMAGES[repo]) return `${image}: ${REMOVED_IMAGES[repo]}`;
      const shape = tag.match(/^(v?)(\d+(?:\.\d+)*)(.*)$/);
      const path = repo.includes("/") ? repo : `library/${repo}`;
      const data = await getJson<{
        results: { name: string; last_updated: string }[];
      }>(`https://hub.docker.com/v2/repositories/${path}/tags?page_size=100&ordering=last_updated`);
      if (!data) return null;
      // Exact-version tags (x.y.z) must be past the cooldown; floating ones (18-alpine) are re-pushed weekly.
      const names = data.results
        .filter((r) => r.name.split(".").length < 3 || oldEnough(r.last_updated))
        .map((r) => r.name);
      const stable = (n: string) => /^v?\d+(\.\d+)*$/.test(n);
      if (!shape) {
        const newest = names.filter(stable).sort(cmp).pop();
        return `${image}: not pinned to a version${newest ? ` — pin it (newest stable: ${newest})` : ""}`;
      }
      const [, v, nums = "", suffix = ""] = shape;
      const depth = nums.split(".").length;
      const same = names.filter((n) => {
        const m = n.match(/^(v?)(\d+(?:\.\d+)*)(.*)$/);
        return m && m[1] === v && m[3] === suffix && (m[2] ?? "").split(".").length === depth;
      });
      const newest = same.sort(cmp).pop();
      if (!newest || cmp(newest, tag) <= 0) return null;
      const note =
        repo.endsWith("postgres") && isMajor(tag, newest)
          ? " — major Postgres upgrade: local data must be reset; the live database is upgraded separately (needs Matt)"
          : "";
      return `${image} → ${repo}:${newest}${note}`;
    }),
  );
  return out.filter((s): s is string => Boolean(s));
};

// ---------- GitHub Actions ---------------------------------------------------------------------
const checkActions = async (): Promise<string[]> => {
  const wfDir = join(dir, ".github/workflows");
  if (!existsSync(wfDir)) return [];
  const uses = new Map<string, string>();
  for (const f of readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n)))
    for (const m of (read(`.github/workflows/${f}`) ?? "").matchAll(
      /uses:\s*([\w.-]+\/[\w.-]+)@v(\d+)/g,
    ))
      uses.set(m[1] as string, m[2] as string);
  const out = await Promise.all(
    [...uses].map(async ([repo, major]) => {
      const rel = await getJson<{ tag_name: string; published_at: string }>(
        `https://api.github.com/repos/${repo}/releases/latest`,
      );
      const latest = rel && oldEnough(rel.published_at) ? parts(rel.tag_name)[0] : undefined;
      return latest && latest > Number(major) ? `${repo}@v${major} → @v${latest}` : null;
    }),
  );
  return out.filter((s): s is string => Boolean(s));
};

// ---------- the plugin itself ------------------------------------------------------------------
const checkPlugin = async (): Promise<string[]> => {
  const local = (
    JSON.parse(readFileSync(join(PLUGIN_ROOT, ".claude-plugin/plugin.json"), "utf8")) as {
      version: string;
    }
  ).version;
  const remote = await getJson<{ version: string }>(REMOTE_PLUGIN_JSON);
  return remote && cmp(remote.version, local) > 0
    ? [
        `stack toolkit ${local} → ${remote.version}: the user runs \`stack update\` in Terminal, then reopens Claude Code`,
      ]
    : [];
};

// ---------- report -----------------------------------------------------------------------------
const report = async (): Promise<string> => {
  const [{ pkgs, failed }, runtimes, images, actions, plugin] = await Promise.all([
    checkPackages(),
    checkRuntimes(),
    checkImages(),
    checkActions(),
    checkPlugin(),
  ]);
  const minor = pkgs.filter((p) => !isMajor(p.current, p.latest));
  const major = pkgs.filter((p) => isMajor(p.current, p.latest));
  const lines: string[] = [];
  const add = (cmd: string, list: Pkg[]) => {
    if (list.length) lines.push(`  ${cmd} ${list.map((p) => `${p.name}@latest`).join(" ")}`);
  };
  if (minor.length) {
    lines.push(
      `Packages — minor/patch (${minor.length}): ${minor.map((p) => `${p.name} ${p.current}→${p.latest}`).join(", ")}`,
    );
    add(
      "bun add",
      minor.filter((p) => !p.dev),
    );
    add(
      "bun add -d",
      minor.filter((p) => p.dev),
    );
  }
  if (major.length) {
    lines.push(`Packages — MAJOR, read the release notes first (${major.length}):`);
    for (const p of major)
      lines.push(
        `  ${p.name} ${p.current} → ${p.latest}${p.dev ? " (dev)" : ""}${p.repo ? `  ${p.repo}/releases` : ""}`,
      );
  }
  if (runtimes.length) lines.push("Runtimes:", ...runtimes.map((s) => `  ${s}`));
  if (images.length) lines.push("Docker images:", ...images.map((s) => `  ${s}`));
  if (actions.length) lines.push("GitHub Actions:", ...actions.map((s) => `  ${s}`));
  if (plugin.length) lines.push("Toolkit:", ...plugin.map((s) => `  ${s}`));
  if (failed.length) lines.push(`(couldn't reach the registry for: ${failed.join(", ")})`);
  return lines.join("\n");
};

let body: string;
if (hook && cacheFresh()) {
  body = readFileSync(cacheFile, "utf8");
} else {
  body = await report();
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, body);
  } catch {
    // cache is a convenience only
  }
}

if (!hook) {
  console.log(body || "Everything is on the latest stable version.");
  process.exit(0);
}
// Hook mode: always hand Claude the current behaviour rules (so existing apps get rule changes with
// the plugin, not by editing their AGENTS.md), plus the version report when something is behind.
const rules = ["session-rules.md", "voice.md"]
  .map((f) => readFileSync(join(PLUGIN_ROOT, "references", f), "utf8").trim())
  .join("\n\n");
const versions = body
  ? `## Version check — this project is NOT on the latest stable versions
${body}

Before building or changing anything else in this session, run /stack:upgrade (it saves the upgrade
as its own change). Tell the user in one line, e.g. "First I'm bringing the app's building blocks up
to date." Don't ask permission for it.`
  : "## Version check\nEverything is on the latest stable version.";
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `${rules}\n\n${versions}`,
    },
  }),
);
