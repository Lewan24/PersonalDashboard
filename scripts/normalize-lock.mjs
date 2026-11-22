// Remove the local cache adapter URL from distributable lockfiles.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../src/personal-hub-web/", import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);
const lock = JSON.parse(
  await readFile(new URL("package-lock.json", root), "utf8"),
);
for (const kind of ["dependencies", "devDependencies"])
  for (const name of Object.keys(packageJson[kind] ?? {})) {
    const version = lock.packages["node_modules/" + name].version;
    packageJson[kind][name] = version;
    lock.packages[""][kind][name] = version;
  }
await writeFile(
  new URL("package.json", root),
  JSON.stringify(packageJson, null, 2) + "\n",
);
await writeFile(
  new URL("package-lock.json", root),
  JSON.stringify(lock, null, 2).replaceAll(
    "http://127.0.0.1:4873/",
    "https://registry.npmjs.org/",
  ) + "\n",
);
