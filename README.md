# [nosedive-legacy-cape](kb/01a1b128-2c08-790f-80f4-e2c40a98bfcc.md)

Legacy nosedive's actions, for a hero migrated to core:

- the work loop, frozen from the work cape at 260eb82, on legacy's own dive kind and the dives legacy nosedive wrote, hung from their feats by `planned.dive`, `jumped.dive`, `packed.dive`, `landed.dive` or `bailed.dive` links that the loop moves: `jump`, `pack`, `land` and `bail`, with the `dive-shape` crud gate and `pass --turn`. It writes only a dive's `diver`, `packer`, scope `ref`s and dated sections, and its link's rel (see the dive kind, Shape). The kind names those rels in `meta.next`, so core's `next` lists each dive under the doc that links it;
- `test`, `hydrate-repo.workspace`, `dehydrate-repo.workspace`, `record.gate` and `note`;
- the migrations `legacy-dives`, retired for a hero that wears legacy and not work (it changes nothing; it still converts a hero wearing work), `legacy-patches`, which pushes a legacy hero's packed patches to its dives' refs and rewrites no doc, and `legacy-dives-restored`, which gives a hero an earlier `legacy-dives` converted its dives' state links back (run `nosedive seed --migrate` on a hero that has already seeded).
