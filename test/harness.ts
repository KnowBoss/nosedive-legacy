import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import type { Cape, Ctx } from "nosedive-core";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { parseDiveBranch } from "../src/i01a1c72ba0a67a64836f167c23ffa097.ts";

const root = mkdtempSync(join(tmpdir(), "nosedive-legacy-"));
after(() => rmSync(root, { recursive: true, force: true }));
// Core keeps repo caches in the user's dir; a test's go in its own.
process.env.NOSEDIVE_USER_DIR = mkdtempSync(join(root, "user-"));

export const WORK_ID = "01a15bb1-da9e-7d2d-aa82-5ee97257adc6";

export function tempDir(label: string): string {
	return mkdtempSync(join(root, `${label}-`));
}

export function git(cwd: string, ...args: string[]): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

function identify(dir: string): void {
	git(dir, "config", "user.name", "Legacy Test");
	git(dir, "config", "user.email", "diver@example.com");
}

type Gate = { id: string; name: string; script: string; scopes?: string };

/**
 * A migrated hero: one root, a feat on it, a registered repo `data` with two commits on origin, a hero-local `gate` kind,
 * and a `bridge:` repo for notes. Gates and dives are added by the test.
 */
export function fixture(label: string) {
	const dir = mkdtempSync(join(root, `${label}-`));
	const remote = join(dir, "data.git");
	git(dir, "init", "-q", "--bare", "-b", "main", remote);
	const seed = join(dir, "data-seed");
	git(dir, "clone", "-q", remote, seed);
	identify(seed);
	writeFileSync(join(seed, "README.md"), "one\n");
	git(seed, "add", "-A");
	git(seed, "commit", "-q", "-m", "first");
	const first = git(seed, "rev-parse", "HEAD");
	writeFileSync(join(seed, "README.md"), "two\n");
	git(seed, "commit", "-q", "-am", "second");
	git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");

	const hero = join(dir, "hero");
	git(dir, "init", "-q", "-b", "main", hero);
	identify(hero);
	const [heroId, repoId, featId, otherFeatId, gateKind, memoKind] = [mintUuid(), mintUuid(), mintUuid(), mintUuid(), mintUuid(), mintUuid()];
	for (const sub of [".nosedive/kinds", ".nosedive/repos", "kb/artifacts", "workspace"]) mkdirSync(join(hero, sub), { recursive: true });
	const kind = (id: string, name: string) => `---\nkind: kind\nid: ${id}\nname: ${name}\ngist: "A ${name}"\n---\n\n# ${name}\n`;
	writeFileSync(join(hero, ".nosedive", "kinds", `${gateKind}.md`), kind(gateKind, "gate"));
	writeFileSync(join(hero, ".nosedive", "kinds", `${memoKind}.md`), kind(memoKind, "memo"));
	writeFileSync(join(hero, ".nosedive", ".gitignore"), "cache/\ncapes/\nlocal/\n");
	writeFileSync(join(hero, ".nosedive", "config.yaml"), `id: ${heroId}\nworkspace: ./workspace\nbridge: ${repoId}\nroots:\n  - kb/${heroId}.md\n`);
	writeFileSync(join(hero, "kb", `${heroId}.md`), `---\nkind: base\nid: ${heroId}\nname: hero\ngist: "A hero"\nlinks:\n  - kb/${featId}.md:\n      rel: work.feat\n  - kb/${otherFeatId}.md:\n      rel: work.feat\n---\n\n# hero\n`);
	writeFileSync(join(hero, ".nosedive", "repos", `${repoId}.md`), `---\nkind: repo\nid: ${repoId}\nname: data\ngist: "Data"\nmeta:\n  trunk: main\n  remotes:\n    origin: ${JSON.stringify(remote)}\n---\n\n# data\n`);
	writeFileSync(join(hero, "kb", `${featId}.md`), `---\nkind: memo\nid: ${featId}\nname: ideas\ngist: "Ideas"\nscopes:\n  - ${repoId}: {}\n---\n\n# Ideas\n`);
	writeFileSync(join(hero, "kb", `${otherFeatId}.md`), `---\nkind: memo\nid: ${otherFeatId}\nname: others\ngist: "Others"\n---\n\n# Others\n`);
	writeFileSync(join(hero, "workspace", ".gitignore"), "*\n");
	git(hero, "add", "-A");
	git(hero, "commit", "-q", "-m", "seed");

	const out: string[] = [];
	const err: string[] = [];
	const core = { id: "01a1336b-c0b8-7cde-b7c6-285196062297", owner: "01a1336b-c0b8-7cde-b7c6-285196062297", shortName: "core", name: "core", version: "test", docs: {}, index: {}, kinds: {} };
	const ctx: Ctx = { cwd: hero, out: (text) => void out.push(text), err: (text) => void err.push(text), stdin: async () => "", capes: [core as unknown as Cape] };

	const path = (id: string) => join(hero, "kb", `${id}.md`);
	/** Appends a link to a doc's frontmatter, kept simple: every fixture doc ends its frontmatter with `---\n\n#`. */
	const link = (from: string, to: string, attrs: string) => {
		const file = from === repoId ? join(hero, ".nosedive", "repos", `${from}.md`) : path(from);
		const text = readFileSync(file, "utf8");
		const entry = `  - kb/${to}.md:\n${attrs.split(", ").map((attr) => `      ${attr}\n`).join("")}`;
		writeFileSync(file, /\nlinks:\n/.test(text) ? text.replace(/\nlinks:\n/, `\nlinks:\n${entry}`) : text.replace(/\n---\n\n#/, `\nlinks:\n${entry}---\n\n#`));
	};
	return {
		hero,
		heroId,
		repoId,
		featId,
		otherFeatId,
		remote,
		first,
		checkout: join(hero, "workspace", "data"),
		ctx,
		out,
		err,
		path,
		link,
		/** A gate whose script runs `body` as run(ctx), declared on `on` with `attrs` when given; committed. */
		gate(name: string, body: string, options: { on?: string; attrs?: string; scopes?: string } = {}): Gate {
			const id = mintUuid();
			const script = `kb/artifacts/${id}.mjs`;
			writeFileSync(join(hero, script), `export async function run(ctx) {\n${body}\n}\n`);
			const scopes = options.scopes === undefined ? "" : `scopes:\n${options.scopes}\n`;
			writeFileSync(path(id), `---\nkind: gate\nid: ${id}\nname: ${name}\ngist: "${name}"\n${scopes}meta:\n  test-script: ${script}\n---\n\n# ${name}\n`);
			if (options.on) link(options.on, id, options.attrs ?? "rel: test.gate");
			git(hero, "add", "-A");
			git(hero, "commit", "-q", "-m", `gate ${name}`);
			return { id, name, script };
		},
		/** A dive of work's kind on `feat`, scoping data at `ref` when given, held by this checkout: unless `hold` is false, the hero is put on its dive branch. */
		dive(feat: string, ref?: string, hold = true): string {
			const id = mintUuid();
			const token = "0123456789ab";
			const scope = ref ? `  - ${repoId}:\n      ref: ${ref}\n` : "";
			writeFileSync(path(id), `---\nkind: dive\nid: ${id}\nname: dive-${id.slice(-6)}\ngist: "A dive"\nscopes:\n  - ${WORK_ID}:\n      canonical: true\n${scope}meta:\n  feat: ${feat}\n  diver: diver@example.com#${token}\n---\n\n# Dive\n`);
			link(feat, id, "rel: dives.feat");
			git(hero, "add", "-A");
			git(hero, "commit", "-q", "-m", "dive");
			if (hold) git(hero, "checkout", "-q", "-b", `nosedive-${token}-${id}`);
			return id;
		},
		commit(message: string) {
			git(hero, "add", "-A");
			git(hero, "commit", "-q", "-m", message);
		},
	};
}

/**
 * A hero for the work loop, wearing legacy and not work, as work's tests made one at 260eb82: by its config, registering
 * one repo, `data`, in .nosedive/repos, with a feat on it, writable unless `readOnly`: under its one root in kb, or with
 * `roots`, under a second root in ./docs. Its upstream is a bare repo, so the loop's records push.
 */
export function loopFixture(label: string, options: { readOnly?: boolean; roots?: boolean } = {}) {
	const dir = tempDir(label);
	const remote = join(dir, "data.git");
	git(dir, "init", "-q", "--bare", "-b", "main", remote);
	const seed = join(dir, "data-seed");
	git(dir, "clone", "-q", remote, seed);
	identify(seed);
	writeFileSync(join(seed, "README.md"), "data\n");
	git(seed, "add", "-A");
	git(seed, "commit", "-q", "-m", "first");
	git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");

	const heroRemote = join(dir, "hero.git");
	git(dir, "init", "-q", "--bare", "-b", "main", heroRemote);
	const hero = join(dir, "hero");
	git(dir, "clone", "-q", heroRemote, hero);
	identify(hero);
	const [heroId, repoId, featId, memoKind] = [mintUuid(), mintUuid(), mintUuid(), mintUuid()];
	mkdirSync(join(hero, ".nosedive"), { recursive: true });
	mkdirSync(join(hero, "kb"));
	const docs = options.roots ? "docs" : "kb";
	const repos = join(".nosedive", "repos");
	mkdirSync(join(hero, docs), { recursive: true });
	mkdirSync(join(hero, repos), { recursive: true });
	mkdirSync(join(hero, ".nosedive", "kinds"));
	writeFileSync(join(hero, ".nosedive", "kinds", `${memoKind}.md`), `---\nkind: kind\nid: ${memoKind}\nname: memo\ngist: "A note"\n---\n\n# Memo\n\n## Drop when\n\nWhat it notes is done.\n`);
	writeFileSync(join(hero, ".nosedive", ".gitignore"), "cache/\ncapes/\nlocal/\n");
	const feats = `links:\n  - ${docs}/${featId}.md:\n      rel: work.feat\n`;
	if (options.roots) {
		const second = mintUuid();
		writeFileSync(join(hero, ".nosedive", "config.yaml"), `id: ${heroId}\nworkspace: ./workspace\nroots:\n  - kb/${heroId}.md\n  - docs/${second}.md\n`);
		writeFileSync(join(hero, "kb", `${heroId}.md`), `---\nkind: root\nid: ${heroId}\nname: kb\ngist: "The first root"\n---\n\n# kb\n`);
		writeFileSync(join(hero, "docs", `${second}.md`), `---\nkind: root\nid: ${second}\nname: docs\ngist: "The second root"\n${feats}---\n\n# docs\n`);
	} else {
		writeFileSync(join(hero, ".nosedive", "config.yaml"), `id: ${heroId}\nworkspace: ./workspace\nroots:\n  - kb/${heroId}.md\n`);
		writeFileSync(join(hero, "kb", `${heroId}.md`), `---\nkind: root\nid: ${heroId}\nname: hero\ngist: "A hero repo"\n${feats}---\n\n# hero\n`);
	}
	writeFileSync(join(hero, repos, `${repoId}.md`), `---\nkind: repo\nid: ${repoId}\nname: data\ngist: "Data"\nmeta:\n  trunk: main\n  remotes:\n    origin: ${JSON.stringify(remote)}\n---\n\n# data\n`);
	const scope = options.readOnly ? `  - ${repoId}\n` : `  - ${repoId}:\n      work-branch: work/ideas\n`;
	writeFileSync(join(hero, docs, `${featId}.md`), `---\nkind: memo\nid: ${featId}\nname: ideas\ngist: "Ideas"\nscopes:\n${scope}---\n\n# Ideas\n`);
	mkdirSync(join(hero, "workspace"));
	writeFileSync(join(hero, "workspace", ".gitignore"), "*\n");
	git(hero, "add", "-A");
	git(hero, "commit", "-q", "-m", "seed");
	git(hero, "push", "-q", "-u", "origin", "HEAD:main");

	const out: string[] = [];
	const err: string[] = [];
	const schemaVersion = git(seed, "rev-parse", "HEAD");
	const cape = (id: string, shortName: string, name: string, kinds: Record<string, unknown>, repoDir?: string) => ({ id, owner: id, shortName, name, repoDir, commit: schemaVersion, version: "test", docs: {}, index: {}, kinds });
	const capes = [cape("01a1336b-c0b8-7cde-b7c6-285196062297", "core", "core", {}), cape("01a1b128-2c08-790f-80f4-e2c40a98bfcc", "nosedive-legacy", "data", { dive: { id: "01a1c72b-a065-7e5b-9c4f-271115cffbe5", version: schemaVersion, schema: { type: "object" } } }, seed)];
	const ctx: Ctx = { cwd: hero, out: (text) => void out.push(text), err: (text) => void err.push(text), stdin: async () => "", capes };
	const checkout = join(hero, "workspace", "data");
	/** Appends a link from a doc to a dive, as `reconcileDiveFeatLinks` wrote one. */
	const linkFrom = (from: string, to: string, rel: string) => {
		const path = join(hero, docs, `${from}.md`);
		const doc = readKbDoc(readFileSync(path, "utf8"));
		const links = Array.isArray(doc.fm.links) ? doc.fm.links : [];
		doc.yaml.set("links", [...links, { [`${docs}/${to}.md`]: { rel } }]);
		writeKbDoc(path, doc.yaml, doc.body);
	};
	return {
		hero,
		heroId,
		remote,
		featId,
		repoId,
		checkout,
		ctx,
		schemaVersion,
		schemaRepo: seed,
		out,
		err,
		/** The id of the dive on deck: the one the hero's dive branch names. */
		onDeck(cwd = hero): string {
			const parsed = parseDiveBranch(git(cwd, "symbolic-ref", "--short", "HEAD"));
			if (!parsed) throw new Error("the hero is on no dive branch");
			return parsed.diveId;
		},
		doc: (id: string) => readFileSync(join(hero, docs, `${id}.md`), "utf8"),
		/** Writes and commits a file in the data checkout. */
		commit(file: string, text: string): string {
			writeFileSync(join(checkout, file), text);
			git(checkout, "add", "-A");
			git(checkout, "commit", "-q", "-m", `add ${file}`);
			return git(checkout, "rev-parse", "HEAD");
		},
		remoteRef: (ref: string) => spawnSync("git", ["rev-parse", "--verify", "-q", ref], { cwd: remote, encoding: "utf8" }).stdout.trim(),
		/**
		 * Plans a dive on the feat as `crud nosedive-legacy:dive <gist> --meta:feat <feat> --section:Brief -` would, dive-shape scoping, naming
		 * and linking it `planned.dive`: committed on the hero's main and pushed. Returns its id.
		 */
		plan(gist = "Do the next part"): string {
			const id = mintUuid();
			const repoScope = options.readOnly ? `  - ${repoId}: {}\n` : `  - ${repoId}:\n      work-branch: work/ideas\n`;
			const scopes = `scopes:\n  - 01a1b128-2c08-790f-80f4-e2c40a98bfcc:\n      canonical: true\n${repoScope}`;
			writeFileSync(join(hero, docs, `${id}.md`), `---\nkind: dive\nid: ${id}\nname: ideas.${id.slice(-6)}\ngist: "${gist}"\n${scopes}meta:\n  feat: ${featId}\n---\n\n# ${gist}\n\n## Brief\n\n${gist}.\n`);
			linkFrom(featId, id, "planned.dive");
			git(hero, "add", "-A");
			git(hero, "commit", "-q", "-m", "plan a dive");
			git(hero, "push", "-q", "origin", "HEAD:main");
			return id;
		},
		/**
		 * A dive as legacy nosedive's record.dive wrote it, which the loop must read as it is: `kind: dive` with no canonical scope, the repo
		 * scoped by `ref` (its pin, the data repo's trunk) and a `work-branch`, `meta` as given (default: `feat` and a null `diver`), named
		 * feat first, hung from `from` (default the feat) by a `<state>.dive` link. Committed on the hero's main and pushed. Returns its id.
		 */
		legacyDive(opts: { state?: string; from?: string; meta?: string[]; gist?: string; name?: string } = {}): string {
			const id = mintUuid();
			const pin = git(remote, "rev-parse", "main");
			const scope = options.readOnly ? `  - ${repoId}:\n      ref: ${pin}\n` : `  - ${repoId}:\n      ref: ${pin}\n      work-branch: work/ideas\n`;
			const meta = (opts.meta ?? [`feat: ${featId}`, "diver: null"]).map((line) => `  ${line}\n`).join("");
			const gist = opts.gist ?? "Working on Ideas.";
			writeFileSync(join(hero, docs, `${id}.md`), `---\nkind: dive\nid: ${id}\nname: ${opts.name ?? `ideas.${id.slice(-6)}`}\ngist: "${gist}"\nscopes:\n${scope}meta:\n${meta}---\n\n# Ideas ${id.slice(-6)}\n\n## Brief\n\n${gist}\n`);
			linkFrom(opts.from ?? featId, id, `${opts.state ?? "planned"}.dive`);
			git(hero, "add", "-A");
			git(hero, "commit", "-q", "-m", "a legacy dive");
			git(hero, "push", "-q", "origin", "HEAD:main");
			return id;
		},
		linkFrom,
		/** The rel of the link a doc holds to another, as the front matter has it. */
		relOf(from: string, to: string): string | undefined {
			const links = readKbDoc(readFileSync(join(hero, docs, `${from}.md`), "utf8")).fm.links as Record<string, { rel?: string }>[] | undefined;
			return links?.flatMap((entry) => Object.entries(entry)).find(([key]) => key.endsWith(`${to}.md`))?.[1]?.rel;
		},
	};
}
