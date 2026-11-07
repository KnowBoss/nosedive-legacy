import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import type { Cape, Ctx } from "nosedive-core";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";

const root = mkdtempSync(join(tmpdir(), "nosedive-legacy-"));
after(() => rmSync(root, { recursive: true, force: true }));
// Core keeps repo caches in the user's dir; a test's go in its own.
process.env.NOSEDIVE_USER_DIR = mkdtempSync(join(root, "user-"));

export const WORK_ID = "01a15bb1-da9e-7d2d-aa82-5ee97257adc6";

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
