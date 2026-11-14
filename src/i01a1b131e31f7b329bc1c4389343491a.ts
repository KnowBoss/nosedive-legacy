import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import type { Bridge, Ctx, KbDoc } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "nosedive-core";
import { checkoutAt, git, i01a1b131e0177e7f8518b309634ebbd8 as findRepo, type RepoDoc } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";
import { scopesOf, type HeldDive } from "./i01a1b131e1947fa5b316b390a3be2415.ts";

export type Doc = KbDoc & { path: string };
export type Link = { id: string; rel: string; attrs: Record<string, unknown> };
/** A gate to run, the doc whose link selected it, and whether that link says it is flaky. */
export type Selected = { gate: Doc; by: Doc | undefined; flaky: boolean };

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A doc's links: the quid its key names, its rel and the rest of its attributes. */
export function linksOf(doc: { fm: Record<string, unknown> }): Link[] {
	const links = Array.isArray(doc.fm.links) ? doc.fm.links : [];
	return links.flatMap((entry) =>
		entry && typeof entry === "object"
			? Object.entries(entry as Record<string, unknown>).flatMap(([key, value]) => {
					const id = QUID.exec(key)?.[0]?.toLowerCase();
					const attrs = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
					return id ? [{ id, rel: String(attrs.rel ?? ""), attrs }] : [];
				})
			: [],
	);
}

/** Every doc the hero holds, in its roots' directories and its repos, by quid. */
export function heroDocs(hero: Bridge): Map<string, Doc> {
	const dirs = new Set([...hero.roots.map((root) => root.dir), ...(hero.reposDir ? [hero.reposDir] : [])]);
	const docs = new Map<string, Doc>();
	for (const dir of dirs) if (existsSync(dir)) for (const doc of listKbDocs(dir)) docs.set(String(doc.fm.id), doc);
	return docs;
}

/** Whether a doc is a gate: it names a test script. */
export function scriptOf(doc: { fm: Record<string, unknown> }): string | undefined {
	const script = (doc.fm.meta as Record<string, unknown> | undefined)?.["test-script"];
	return typeof script === "string" && script ? script : undefined;
}

/** Spawned per gate, so a gate that exits or crashes takes down its own process; drained rather than exited, as legacy's was. */
const RUNNER = `import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL(process.env.NOSEDIVE_GATE_MODULE).href);
if (typeof mod.run !== "function") {
	console.error("gate module must export run(ctx)");
	process.exit(1);
}
const ctx = JSON.parse(process.env.NOSEDIVE_GATE_CONTEXT);
process.channel.unref();
const waiting = new Map();
process.on("message", ({ quid, doc }) => {
	const done = waiting.get(quid);
	waiting.delete(quid);
	if (waiting.size === 0) process.channel.unref();
	done(doc);
});
ctx.resolve = (quid) =>
	new Promise((resolve, reject) => {
		process.channel.ref();
		waiting.set(quid, (doc) => (doc ? resolve(doc) : reject(new Error("no kb doc has quid " + quid))));
		process.send({ quid });
	});

const outcome = await mod.run(ctx);
if (outcome === false) process.exitCode = 1;

const idleMs = Number(process.env.NOSEDIVE_GATE_IDLE_MS || 30000);
let idle;
const rearm = () => {
	clearTimeout(idle);
	idle = setTimeout(() => {
		writeSync(2, "gate produced no output for " + idleMs + "ms; forcing exit" + String.fromCharCode(10));
		process.exit(1);
	}, idleMs);
	idle.unref();
};
for (const stream of [process.stdout, process.stderr]) {
	const write = stream.write.bind(stream);
	stream.write = (...args) => {
		rearm();
		return write(...args);
	};
}
rearm();
`;

/** Runs one gate's script in its own process with its ctx, answering its resolves; returns its exit status. */
function runGate(hero: Bridge, script: string, context: Record<string, unknown>, runner: string, capture?: string[]): Promise<number> {
	return new Promise((done, fail) => {
		const child = spawn(process.execPath, [runner], {
			cwd: hero.dir,
			stdio: ["inherit", "inherit", capture ? "pipe" : "inherit", "ipc"],
			env: { ...process.env, NOSEDIVE_GATE_MODULE: script, NOSEDIVE_GATE_CONTEXT: JSON.stringify(context) },
		});
		child.on("message", (message: { quid: string }) => {
			const doc = locateKbDoc(hero, message.quid);
			child.send({ quid: message.quid, doc: doc ? { id: String(doc.fm.id), fm: doc.fm, body: doc.body, path: relative(hero.dir, doc.path).replace(/\\/g, "/") } : null });
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			capture?.push(chunk.toString());
			process.stderr.write(chunk);
		});
		child.on("error", fail);
		child.on("exit", (code) => done(code ?? 1));
	});
}

/** How one gate fared: its stderr is kept only when it ran with `live` repos. */
export type GateResult = { gate: Doc; name: string; script: string; flaky: boolean; ok: boolean; ms: number; stderr: string };

/**
 * Runs the selected gates in order, each with its scopes checked out and legacy's ctx, streaming their output; every gate
 * runs whatever came before. Throws, after the summary, when a gate failed whose link is not flaky.
 */
export async function i01a1b131e31f7b329bc1c4389343491a(hero: Bridge, selected: Selected[], dive: HeldDive | undefined, ctx: Ctx): Promise<void> {
	if (selected.length === 0) throw new Error("no gates were selected, and running none would pass having checked nothing");
	const results = await executeGates(hero, selected, dive, ctx);
	const failed = results.filter((result) => !result.ok);
	const blocking = failed.filter((gate) => !gate.flaky);
	const warned = failed.filter((gate) => gate.flaky);
	ctx.out(`${selected.length - failed.length} of ${selected.length} gates passed`);
	if (warned.length) ctx.out(`failed, flaky: ${warned.map((gate) => gate.name).join(", ")}`);
	if (blocking.length) throw new Error(`${blocking.length} gate${blocking.length === 1 ? "" : "s"} failed: ${blocking.map((gate) => gate.name).join(", ")}`);
}

/**
 * Runs each gate whatever came before and says how each fared. With `live`, every gate sees those repos, the dive's own
 * checkouts as they stand, rather than checking its scopes out at their refs, and its stderr is kept.
 */
export async function executeGates(hero: Bridge, selected: Selected[], dive: HeldDive | undefined, ctx: Ctx, live?: Record<string, { id: string; root: string }>): Promise<GateResult[]> {
	const results: GateResult[] = [];
	const dir = mkdtempSync(join(tmpdir(), "nosedive-gate-"));
	const runner = join(dir, "gate-runner.mjs");
	writeFileSync(runner, RUNNER);
	const claims = new Map<string, { ref: string | undefined; by: string; root: string }>();
	try {
		for (const { gate, by, flaky } of selected) {
			const name = String(gate.fm.name);
			const shown = relative(hero.dir, gate.path).replace(/\\/g, "/");
			ctx.out(`gate ${name} (${shown})`);
			const script = scriptOf(gate)!;
			const scriptPath = isAbsolute(script) ? script : join(hero.dir, script);
			if (!existsSync(scriptPath)) {
				const stderr = `${name}'s meta.test-script ${script} is no file`;
				ctx.err(`nosedive: ${stderr}`);
				results.push({ gate, name, script, flaky, ok: false, ms: 0, stderr });
				continue;
			}
			if (!live && git(hero.dir, "status", "--porcelain", "--", gate.path, scriptPath).text) ctx.err(`nosedive: ${name}'s doc or script has uncommitted changes, which land would not accept yet`);

			const scopes = live ? [] : "scopes" in gate.fm ? scopesOf(hero, gate) : by ? scopesOf(hero, by) : [];
			const repos: Record<string, { id: string; root: string }> = { ...live };
			for (const scope of scopes) {
				const repo: RepoDoc = findRepo(hero, scope.repoId);
				const claim = claims.get(scope.repoId);
				if (claim) {
					if (claim.ref !== scope.ref) ctx.err(`nosedive: ${name} wants ${String(repo.fm.name)} at ${scope.ref ?? "trunk"}, but ${claim.by} checked it out at ${claim.ref ?? "trunk"} first`);
				} else {
					const { root, head } = checkoutAt(hero, repo, scope.ref, ctx);
					ctx.err(`nosedive: ${String(repo.fm.name)} at ${head.slice(0, 12)}`);
					claims.set(scope.repoId, { ref: scope.ref, by: name, root });
				}
				repos[String(repo.fm.name)] = { id: scope.repoId, root: claims.get(scope.repoId)!.root };
			}
			if (!live && scopes.length === 0) ctx.err(`nosedive: ${name} runs with no repos`);

			const context = {
				bridgeRoot: hero.dir,
				diveId: dive?.id ?? "",
				...(dive?.featId ? { featId: dive.featId } : {}),
				gateId: String(gate.fm.id),
				introducedById: by ? String(by.fm.id) : String(gate.fm.id),
				repos,
			};
			const captured: string[] | undefined = live ? [] : undefined;
			const started = Date.now();
			const status = await runGate(hero, scriptPath, context, runner, captured);
			results.push({ gate, name, script, flaky, ok: status === 0, ms: Date.now() - started, stderr: (captured ?? []).join("") });
			if (status === 0) ctx.out(`  passed`);
			else ctx.out(flaky ? `  failed (flaky)` : `  failed`);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	return results;
}
