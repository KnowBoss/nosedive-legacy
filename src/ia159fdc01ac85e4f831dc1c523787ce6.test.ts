// bail [<dive>] --reason <why>
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { ia159fdc01ac85e4f831dc1c523787ce6 as bail } from "./ia159fdc01ac85e4f831dc1c523787ce6.ts";
import { loopFixture as fixture, git } from "../test/harness.ts";

test("keeps what the dive held on its ref, uncommitted work included, records why, leaves the checkout at its base, and ends it", async () => {
	const f = fixture("bail");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const base = git(f.checkout, "rev-parse", "HEAD");
	f.commit("idea.md", "an idea\n");
	const short = git(f.checkout, "rev-parse", "--short", "HEAD");
	writeFileSync(join(f.checkout, "draft.md"), "half\n");

	await bail({ reason: "a better idea came along" }, f.ctx);
	const ref = `refs/nosedive/${f.heroId}/dives/${id}`;
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), base);
	assert.equal(git(f.remote, "log", "-1", "--format=%s", ref), `pack(${id.slice(-6)}.ideas): work in progress`, "nothing it held is lost");
	assert.equal(git(f.remote, "log", "-1", "--format=%(trailers:only,unfold)", ref), "Co-Authored-By: nosedive test <noreply@nosedive.dev>", "and says nosedive made it, once");
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), `bail(${id.slice(-6)}.ideas): a better idea came along`);
	assert.equal(git(f.hero, "log", "-1", "--format=%(trailers:only,unfold)"), "Co-Authored-By: nosedive test <noreply@nosedive.dev>");
	assert.equal(git(f.checkout, "branch", "--list", `*/${id}`), "", "its branch is gone");
	const doc = f.doc(id);
	assert.match(doc, /\nmeta:\n {2}feat: [0-9a-f-]{36}\n---\n/);
	assert.doesNotMatch(doc, /outcome/, "how it ended is its feat's link, not its meta");
	assert.equal(f.relOf(f.featId, id), "bailed.dive");
	assert.match(doc, new RegExp(`\\n## \\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z bailed\\n\\ndiver@example\\.com bailed: a better idea came along\\n\\n- data: held ${short} add idea\\.md; \\w+ pack\\(${id.slice(-6)}\\.ideas\\): work in progress, kept on ${ref}\\n- hero: held no commits\\n$`));
	assert.throws(() => f.onDeck());
	await assert.rejects(jump({ ref: id }, f.ctx), /is over: it bailed/);
});

test("needs a reason", async () => {
	const f = fixture("bail-reason");
	await assert.rejects(bail({ reason: " " }, f.ctx), /bail needs a reason/);
});

test("bails without atomic-push support at the origin", async () => {
	const f = fixture("bail-no-atomic");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const committed = f.commit("idea.md", "an idea\n");
	git(f.remote, "config", "receive.advertiseAtomic", "false");

	await bail({ reason: "no longer needed" }, f.ctx);

	assert.equal(f.remoteRef(`refs/nosedive/${f.heroId}/dives/${id}`), committed);
	assert.throws(() => f.onDeck());
});

test("bail's usage binds --reason as reason, the key bail reads (bail-reason-binding)", async () => {
	const { i01a1335482437c9eb145885f65f12aa1: matchUsage } = await import("nosedive-core");
	assert.equal(matchUsage(["bail [<dive>] --reason <why>"], ["bail", "--reason", "gone stale"]).args.reason, "gone stale");
});
