import { execSync } from "node:child_process";

export function gitSha(short = true): string {
  try {
    const args = short ? "git rev-parse --short HEAD" : "git rev-parse HEAD";
    return execSync(args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

export function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
