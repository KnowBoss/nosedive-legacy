# [nosedive-legacy-cape](kb/01a1b128-2c08-790f-80f4-e2c40a98bfcc.md)

Legacy nosedive's actions, for a hero migrated to core:

- the work loop, frozen from the work cape at 260eb82, on legacy's own dive kind and the dives legacy nosedive wrote, hung from their feats by `planned.dive`, `jumped.dive`, `packed.dive`, `landed.dive` or `bailed.dive` links that the loop moves: `jump`, `pack`, `land` and `bail`, with the `dive-shape` crud gate and `pass --turn`. It writes only a dive's `diver`, `packer`, scope `ref`s and dated sections, and its link's rel (see the dive kind, Shape). The kind names those rels in `meta.next`, so core's `next` lists each dive under the doc that links it;
- `test`, `hydrate-repo.workspace`, `dehydrate-repo.workspace`, `record.gate` and `note`;
- the migrations `legacy-dives`, retired for a hero that wears legacy and not work (it changes nothing; it still converts a hero wearing work), `legacy-patches`, which pushes a legacy hero's packed patches to its dives' refs and rewrites no doc, and `legacy-dives-restored`, which gives a hero an earlier `legacy-dives` converted its dives' state links back (run `nosedive seed --migrate` on a hero that has already seeded).

## Testing

Legacy runs against a built [nosedive-core](https://github.com/KnowBoss/nosedive-core) checked out beside it, at `../nosedive-core` (or `NOSEDIVE_CORE_DIR`): `npm ci && npm run build` there first.

- `npm run typecheck`: `tsc`, against core's `dist/core.d.ts`.
- `npm test`: every `src/*.test.ts`, `nosedive-core` resolved to core's `dist/core.js`, as core's `pass --test` runs a cape's tests.
- `npm run smoke`: `scripts/smoke.sh` seeds a throwaway hero with core's launcher, wears legacy at this checkout's HEAD commit (so commit first), lets core build the cape and run its migrations, then jumps, packs, jumps again and lands a dive, and jumps and bails another.

CI (`.github/workflows/core-main.yml`) runs all three against core's `main` head on every push to main, every PR and daily.
