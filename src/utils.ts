/**
 * Semantic version comparison.
 * Returns true if `version` is strictly newer than `otherVersion`.
 * Mirrors the approach used by the Excalidraw plugin.
 */
export function isVersionNewerThanOther(version: string, otherVersion: string): boolean {
  if (!version || !otherVersion) return true;
  const v = version.match(/(\d+)\.(\d+)\.(\d+)/);
  const o = otherVersion.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!v || !o) return false;
  const [, vm, vn, vp] = v.map(Number);
  const [, om, on, op] = o.map(Number);
  return vm > om || (vm === om && vn > on) || (vm === om && vn === on && vp > op);
}
