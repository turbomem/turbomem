/** Browser build stub — disk directory creation is Node-only. */
export async function ensureDiskDirectory(_dataDir: string): Promise<void> {
  // No-op: browser builds use idb:// or in-memory paths only.
}
