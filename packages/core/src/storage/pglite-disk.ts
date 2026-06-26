export async function ensureDiskDirectory(dataDir: string): Promise<void> {
  const { existsSync, mkdirSync } = await import("node:fs");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}
