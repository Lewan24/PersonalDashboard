import { readFile, writeFile } from "node:fs/promises";
const source = process.env.HUB_URL
  ? await (await fetch(process.env.HUB_URL + "/openapi/v1.json")).text()
  : await readFile(new URL("../docs/openapi.json", import.meta.url), "utf8");
const document = JSON.parse(source);
const routes = Object.entries(document.paths)
  .flatMap(([path, methods]) =>
    Object.keys(methods)
      .filter((m) => ["get", "post", "patch", "delete", "put"].includes(m))
      .map((m) => m.toUpperCase() + " " + path),
  )
  .sort();
const output =
  "// Generated from docs/openapi.json. Do not edit.\nexport type ApiRoute =\n" +
  routes.map((x) => "  | " + JSON.stringify(x)).join("\n") +
  ";\n";
const path = new URL(
  "../src/personal-hub-web/src/generated/routes.ts",
  import.meta.url,
);
if (process.argv.includes("--check")) {
  if ((await readFile(path, "utf8")) !== output)
    throw new Error(
      "API contract changed. Run node scripts/openapi-contract.mjs",
    );
  console.log("API route contract matches (" + routes.length + " operations).");
} else await writeFile(path, output);
