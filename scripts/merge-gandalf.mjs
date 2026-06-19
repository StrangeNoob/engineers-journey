// Merge the Gandalf character mesh + the animation clips into one
// public/assets/models/gandalf.glb with clips renamed to engine roles.
// Run: npm run merge:gandalf
//
// Inputs (assets-src/gandalf/):
//   character.glb   — the (re-textured) skinned character + skeleton (the base)
//   animations.glb  — the same skeleton carrying the named animation clips
// Both must share the Armature skeleton (identical bone names); the script
// validates this and aborts on a mismatch. Animation clips are grafted onto the
// base skeleton by matching bone names, so a small mesh-vertex difference between
// the two files is fine — only the bones matter for animation.
import { NodeIO } from "@gltf-transform/core";
import { prune, dedup } from "@gltf-transform/functions";

const SRC = "assets-src/gandalf";
const OUT = "public/assets/models/gandalf.glb";

// Source clip name -> engine role. Unmapped clips are dropped.
const CLIP_ROLE = {
  Idle_11: "idle",
  Walking: "walk",
  Running: "run",
  Talk_with_Left_Hand_Raised: "wave",
  Talk_with_Hands_Open: "listening",
  Regular_Jump: "jump",
};

async function main() {
  const io = new NodeIO();
  const base = await io.read(`${SRC}/character.glb`);
  const anims = await io.read(`${SRC}/animations.glb`);

  const baseNodes = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]));
  const baseBuffer = base.getRoot().listBuffers()[0];

  // Validate: every bone an animation drives must exist in the base skeleton.
  const animBones = new Set();
  for (const a of anims.getRoot().listAnimations()) {
    for (const ch of a.listChannels()) {
      const n = ch.getTargetNode()?.getName();
      if (n) animBones.add(n);
    }
  }
  const missing = [...animBones].filter((n) => !baseNodes.has(n));
  if (missing.length) {
    console.error(`Skeleton mismatch — bones in animations.glb not found in character.glb:\n  ${missing.join(", ")}`);
    process.exit(1);
  }

  // Replace any animations the base already carries with the renamed grafts.
  for (const a of base.getRoot().listAnimations()) a.dispose();

  let grafted = 0;
  for (const a of anims.getRoot().listAnimations()) {
    const role = CLIP_ROLE[a.getName()];
    if (!role) { console.warn(`skipping unmapped clip: ${a.getName()}`); continue; }
    const out = base.createAnimation(role);
    for (const ch of a.listChannels()) {
      const tname = ch.getTargetNode()?.getName();
      const target = tname ? baseNodes.get(tname) : null;
      if (!target) continue;
      const s = ch.getSampler();
      const input = base.createAccessor().setType(s.getInput().getType())
        .setArray(s.getInput().getArray().slice()).setBuffer(baseBuffer);
      const output = base.createAccessor().setType(s.getOutput().getType())
        .setArray(s.getOutput().getArray().slice()).setBuffer(baseBuffer);
      const sampler = base.createAnimationSampler()
        .setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
      out.addSampler(sampler);
      out.addChannel(base.createAnimationChannel()
        .setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
    grafted++;
  }

  const expected = Object.keys(CLIP_ROLE).length;
  if (grafted !== expected) {
    console.error(`Expected ${expected} mapped clips but grafted ${grafted} — source clip names may have changed; check CLIP_ROLE against animations.glb.`);
    process.exit(1);
  }

  // Drop the unused emissive (the character was exported self-lit; the engine lights it).
  for (const mat of base.getRoot().listMaterials()) {
    mat.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
  }

  await base.transform(dedup(), prune());
  await io.write(OUT, base);

  const clips = base.getRoot().listAnimations().map((x) => x.getName());
  console.log(`Wrote ${OUT}: grafted ${grafted} clips -> [${clips.join(", ")}]`);
}

main().catch((e) => { console.error("merge-gandalf failed:", e); process.exit(1); });
