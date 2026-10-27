import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "apps", "site", "dist");
const target = path.join(root, "dist");

try {
  await access(source);
} catch {
  console.error(`Site build not found at ${source}`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Copied ${path.relative(root, source)} to ${path.relative(root, target)}`);
