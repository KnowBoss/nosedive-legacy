import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { Args, Bridge, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { coAuthor, commitOffside, docAt, fetchExact, replay, stampRange } from "nosedive-core";
import type { LocalStep, RemoteUpdate, Sha, Step } from "nosedive-core";
import { executeGates, heroDocs, linksOf, scriptOf, type GateResult, type Selected } from "./i01a1b131e31f7b329bc1c4389343491a.ts";
import { reachedFeats } from "./iffb5aa30b4e659e68b40ad7dee378a62.ts";
import { i01a1c72ba0a67a64836f167c23ffa097 as diveOnDeck, type Dive, carry, diveRefs, durableFeat, emailOf, fetchHome, heroDoc, homeUpdate, homeUpstream, keyOf, localDiveRefs, packIgnored, planHome, readOnlyRefusals, recordOn, replanning, scopesWith } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { sectionChange } from "./i01a1c72ba0b57a0c80e3fdd641d001a8.ts";
import { i01a1c72ba0c37d27a058e908481307c3 as runGit } from "./i01a1c72ba0c37d27a058e908481307c3.ts";

export async function i3b8461aa9eac5f10837c2515b5231e78(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("land works in a hero repo, and this is not one");
	const dive = diveOnDeck(hero, ctx, typeof args.dive === "string" ? args.dive : undefined);
	const me = emailOf(hero);
	const id = String(dive.doc.fm.id);
	const writable = dive.scopes.filter((scope) => scope.branch && scope.ours);
	const version = ctx.capes[0]!.version;

	let gated = false;
	let gateRun: { results: GateResult[]; heading: string; blocking: GateResult[] } | undefined;
	let report: { parent: Sha; tip: Sha; made: Set<Sha> } | undefined;
	const lines = await replanning(async () => {
		// Every refusal is found before anything is pushed, and so is every conflict.
		const refused = readOnlyRefusals(dive);
		if (runGit(hero.dir, "status", "--porcelain").text) refused.push("the hero has uncommitted changes: commit them first");
		// The hero's work goes home, the branch the dive was jumped from, which must be its upstream's (records-on-jumped-branch).
		const { home } = dive;
		const up = homeUpstream(hero, home);
		let homeTip = "";
		try {
			const upstream = fetchHome(hero, up);
			homeTip = upstream;
		} catch (error) {
			refused.push((error as Error).message);
		}
		const found = new Map<string, Sha | null>();
		for (const scope of writable) {
			const shown = relative(hero.dir, scope.dir).replace(/\\/g, "/");
			if (runGit(scope.dir, "status", "--porcelain").text) refused.push(`${shown} has uncommitted changes: commit them first`);
			// Exact: what the work branch holds now, which the push is leased on and the stamps start from.
			let work: Sha | null = null;
			try {
				work = fetchExact(scope.dir, "origin", [`refs/heads/${scope.branch}`])[`refs/heads/${scope.branch}`] ?? null;
			} catch (error) {
				refused.push((error as Error).message);
			}
			found.set(scope.repoId, work);
			if (work && !runGit(scope.dir, "merge-base", "--is-ancestor", work, "HEAD").ok) {
				refused.push(`${scope.branch} in ${scope.name} has moved to ${work.slice(0, 7)}, which this dive's work does not contain: pack, then jump ${id}, which rebases the work onto it`);
			}
		}
		// The home's commits nosedive made go first, replayed, so the dive's hero work is replayed onto what is published.
		let homePlan: ReturnType<typeof planHome> | undefined;
		if (homeTip) {
			try {
				homePlan = planHome(hero, home, up, homeTip);
			} catch (error) {
				refused.push((error as Error).message);
			}
		}
		const gates = selectGates(hero, dive, refused);
		if (refused.length > 0 || !homePlan) throw new Error(`nothing was landed:\n  ${refused.join("\n  ")}`);

		// Gates see the checkouts as they are about to be pushed, and one blocking failure pushes nothing; they run once, whatever is planned again.
		if (gates.length > 0 && !gated) {
			gated = true;
			const live = Object.fromEntries(dive.scopes.filter((scope) => scope.ours).map((scope) => [scope.name, { id: scope.repoId, root: relative(hero.dir, scope.dir).replace(/\\/g, "/") }]));
			const results = await executeGates(hero, gates, { id, doc: dive.doc, featId: dive.featId, scopes: [] }, ctx, live);
			const blocking = results.filter((result) => !result.ok && !result.flaky);
			gateRun = { results, heading: `## Land report ${new Date().toISOString()}`, blocking };
		}
		const head0 = runGit(hero.dir, "rev-parse", "HEAD").text;
		if (gateRun && report?.parent !== head0) report = recordReport(hero, head0, keyOf(hero, dive.doc), gateRun.heading, gateRun.results, version);
		if (gateRun && gateRun.blocking.length > 0) {
			const branch = `refs/heads/${dive.branch}`;
			carry({ steps: [{ repo: "hero", dir: hero.dir, local: { moves: [{ ref: branch, old: head0, new: report!.tip }], files: { from: head0, to: report!.tip } } }] }, "land");
			throw new Error(`nothing was landed: ${gateRun.blocking.length} gate${gateRun.blocking.length === 1 ? "" : "s"} failed: ${gateRun.blocking.map((gate) => gate.name).join(", ")}; the report is on the dive`);
		}

		const trailers = [`Nosedive-Dive: ${id}`, `Nosedive-Feat: ${durableFeat(hero, dive, ctx.capes)}`, coAuthor(version)];
		const notes: string[] = [];
		const steps: Step[] = [];
		const after: LocalStep[] = [];
		const branch = `refs/heads/${dive.branch}`;
		for (const scope of writable) {
			const work = found.get(scope.repoId) ?? null;
			const trunk = work ? null : fetchExact(scope.dir, "origin", [`refs/heads/${scope.trunk}`])[`refs/heads/${scope.trunk}`] ?? null;
			const base = work ?? trunk;
			const head = runGit(scope.dir, "rev-parse", "HEAD").text;
			const seen = diveRefs(scope.dir, id);
			const stampedHead = base && runGit(scope.dir, "rev-list", "--count", `${base}..${head}`).text === "0" ? undefined : stampRange(scope.dir, base, head, trailers);
			const updates: RemoteUpdate[] = [];
			if (stampedHead) {
				updates.push({ ref: `refs/heads/${scope.branch}`, old: work, new: stampedHead.tip, fastForward: true, publishes: stampedHead.made });
				notes.push(`- ${scope.name}: pushed ${stampedHead.tip.slice(0, 7)} to ${scope.branch}`);
			} else notes.push(`- ${scope.name}: unchanged`);
			for (const { ref, sha } of seen) updates.push({ ref, old: sha, new: null, fastForward: false });
			const tip = stampedHead?.tip ?? head;
			const moves = [
				...(tip !== head ? [{ ref: branch, old: head, new: tip }] : []),
				...localDiveRefs(scope.dir, id).map(({ ref, sha }) => ({ ref, old: sha, new: null })),
			];
			steps.push({ repo: scope.name, dir: scope.dir, ...(updates.length > 0 ? { remote: { name: "origin", updates } } : {}), local: { moves } });
			// Left where it landed, its branch gone: the work branch holds it now.
			after.push({ repo: scope.name, dir: scope.dir, local: { head: { from: { branch: dive.branch }, to: { detached: tip } }, drop: [{ ref: branch, old: tip, new: null }] } });
		}

		// The hero's own work, replayed onto the home as it is to be published, then stamped; a conflict is met here, before any scope is pushed.
		const d0 = report?.tip ?? head0;
		const work = runGit(hero.dir, "rev-list", "--reverse", "--topo-order", d0, "--not", `refs/heads/${home}`).text.split("\n").filter(Boolean);
		const set = new Set<Sha>();
		let heroTip: Sha = homePlan.tip;
		if (work.length > 0) {
			const replayed = replay(hero.dir, work, homePlan.tip);
			if ("conflict" in replayed) throw new Error(`the hero's work conflicts with ${home}, so nothing was landed: rebase ${dive.branch} onto ${home}, then land ${id} again\n${replayed.conflict}`);
			for (const sha of replayed.made) set.add(sha);
			const stamped = stampRange(hero.dir, homePlan.tip, replayed.tip, trailers);
			for (const sha of stamped.made) set.add(sha);
			heroTip = stamped.tip;
			const count = runGit(hero.dir, "rev-list", "--count", `${homePlan.tip}..${heroTip}`).text;
			if (count !== "0") notes.push(`- hero: ${count} commit${count === "1" ? "" : "s"} onto ${home}`);
		}

		// Home, its work on it between the jump record and the land record, the dive branch gone (loop-returns-home).
		const cleared = new Map<string, string | undefined>([...dive.scopes.map((scope): [string, undefined] => [scope.repoId, undefined]), [hero.id!, undefined]]);
		const doc = heroDoc(hero, id)!;
		const made = recordOn(hero, heroTip, keyOf(hero, doc), { action: "land", label: "landed", summary: `${me} landed it`, state: "landed", meta: { diver: null }, scopes: scopesWith(hero, doc, cleared), lines: [`${me} landed it.`, "", ...notes] }, version);
		const heroSeen = diveRefs(hero.dir, id);
		steps.push({
			repo: "hero",
			dir: hero.dir,
			remote: { name: up.remote, updates: [...heroSeen.map(({ ref, sha }): RemoteUpdate => ({ ref, old: sha, new: null, fastForward: false })), homeUpdate(homePlan, made.tip, [...set, made.tip])] },
			local: {
				moves: [
					{ ref: `refs/heads/${home}`, old: homePlan.old, new: made.tip },
					...localDiveRefs(hero.dir, id).map(({ ref, sha }) => ({ ref, old: sha, new: null })),
				],
				head: { from: { branch: dive.branch }, to: { branch: home } },
				files: { from: head0, to: made.tip },
				drop: [{ ref: branch, old: head0, new: null }],
			},
		});
		carry({ steps, after }, "land");
		return notes;
	});

	const featId = dive.featId;
	for (const scope of dive.scopes.filter((each) => each.ours)) packIgnored(hero, featId, scope);
	ctx.out(`landed ${String(dive.doc.fm.name)}${lines.length > 0 ? `\n${lines.join("\n")}` : ""}`);
}

/**
 * The land.gate links on the dive, its scoped repos and the feats its feat reaches along .feat edges, tallest gate-height first,
 * ties in discovery order; a gate reached twice keeps its first link's attributes. What would stop one running is added to `refused`.
 */
function selectGates(hero: Bridge, dive: Dive, refused: string[]): Selected[] {
	const docs = heroDocs(hero);
	const declarers = [dive.doc, ...dive.scopes.flatMap((scope) => docs.get(scope.repoId) ?? []), ...(dive.feat ? reachedFeats(docs, dive.featId).flatMap((id) => docs.get(id) ?? []) : [])];
	const found: { selected: Selected; height: number }[] = [];
	const seen = new Set<string>();
	for (const by of declarers) {
		for (const link of linksOf(by)) {
			if (link.rel !== "land.gate" || seen.has(link.id)) continue;
			seen.add(link.id);
			const gate = docs.get(link.id);
			if (!gate) {
				refused.push(`${String(by.fm.name)} declares gate ${link.id}, which is no doc`);
				continue;
			}
			const name = String(gate.fm.name);
			const script = scriptOf(gate);
			if (!script) {
				refused.push(`gate ${name} has no meta.test-script: add one naming a bridge-relative file`);
				continue;
			}
			const scriptPath = isAbsolute(script) ? script : join(hero.dir, script);
			if (!existsSync(scriptPath)) refused.push(`gate ${name}'s meta.test-script ${script} is no file`);
			else if (runGit(hero.dir, "status", "--porcelain", "--", gate.path, scriptPath).text) refused.push(`gate ${name}'s doc or script has uncommitted changes: commit them first`);
			const height = Number(link.attrs["gate-height"] ?? 0);
			found.push({ selected: { gate, by, flaky: link.attrs["test-is-flaky"] === true }, height: Number.isFinite(height) ? height : 0 });
		}
	}
	return found.sort((a, b) => b.height - a.height).map((each) => each.selected);
}

/** Builds a report commit from the dive doc at the planned parent, without touching a file or ref. */
function recordReport(hero: Bridge, parent: Sha, rel: string, heading: string, results: GateResult[], version: string): { parent: Sha; tip: Sha; made: Set<Sha> } {
	const doc = docAt(hero.dir, parent, rel);
	if (!doc) throw new Error(`${rel} is no dive at ${parent.slice(0, 7)}`);
	const lines = results.map((result) => {
		const link = `[${result.name}](${relative(dirname(join(hero.dir, rel)), result.gate.path).replace(/\\/g, "/")})`;
		if (result.ok) return `- ${link}: passed in ${result.ms}ms`;
		const stderr = result.stderr.trimEnd().split("\n").map((line) => `  ${line}`.trimEnd());
		return [`- ${link}: failed${result.flaky ? " (flaky, a warning)" : ""} in ${result.ms}ms`, "", `  script: ${result.script}`, "", "  ```", ...stderr, "  ```"].join("\n");
	});
	const failed = results.filter((result) => !result.ok).length;
	const change = sectionChange(doc, heading, lines, { action: "land", summary: `ran ${results.length} gate${results.length === 1 ? "" : "s"}, ${failed} failed` });
	return { parent, ...commitOffside(hero.dir, parent, { [rel]: change.text }, change.message, version) };
}
