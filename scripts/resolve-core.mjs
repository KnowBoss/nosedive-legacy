// Resolves `nosedive-core` to a built core, as core's run-repo-tests does for a cape's tests:
// $NOSEDIVE_CORE_DIR/dist/core.js, else a sibling checkout's, ../nosedive-core (the path tsconfig.json maps).
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const core = resolve(process.env.NOSEDIVE_CORE_DIR ?? "../nosedive-core", "dist", "core.js");
if (!existsSync(core)) throw new Error(`no built core at ${core}: run \`npm ci && npm run build\` in a nosedive-core checkout, or set NOSEDIVE_CORE_DIR`);
const url = pathToFileURL(core).href;
registerHooks({ resolve: (specifier, context, next) => (specifier === "nosedive-core" ? { url, shortCircuit: true } : next(specifier, context)) });
