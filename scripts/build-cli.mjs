// Bundles the CLI (dist/cli.mjs) and the production server (dist/serve.mjs) with their
// dependencies, so the image needs only esbuild (native) at runtime.
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const at = (p) => fileURLToPath(new URL(p, import.meta.url))
const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  jsx: "automatic",
  logLevel: "warning",
  // Bundled CommonJS dependencies call require(); give ESM output one.
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
}

await esbuild.build({
  ...common,
  entryPoints: [at("../src/cli/index.ts")],
  outfile: at("../dist/cli.mjs"),
  external: ["esbuild"],
  loader: { ".css": "empty" },
  alias: { "@": at("../src"), "@tanstack/react-start/server-only": at("./empty.mjs") },
})

await esbuild.build({
  ...common,
  entryPoints: [at("../server.mjs")],
  outfile: at("../dist/serve.mjs"),
  external: ["./dist/server/server.js"],
})
