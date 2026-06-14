import { join, basename } from "path";
import { mkdtempSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";

const REPO_ROOT = join(import.meta.dir, "..");

export const hookPath = (name: string) =>
  join(REPO_ROOT, "adapters/claude-code/hooks", name);

export function makeHome(): string {
  return mkdtempSync(join(tmpdir(), "agentrpg-test-"));
}

export async function runHook(
  name: string,
  input: object,
  home: string,
  extraEnv: Record<string, string> = {},
) {
  const proc = Bun.spawn(["bash", hookPath(name)], {
    stdin: Buffer.from(JSON.stringify(input)),
    env: { ...process.env, AGENTRPG_HOME: home, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { stdout, stderr, code };
}

export function journalLines(home: string, sid: string): any[] {
  const p = join(home, "journal", `${sid}.ndjson`);
  if (!existsSync(p)) {
    return [];
  }
  return readFileSync(p, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(l => JSON.parse(l));
}

export function repoCache(home: string, sid: string): string | null {
  const p = join(home, "journal", `${sid}.repo`);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export { basename };
