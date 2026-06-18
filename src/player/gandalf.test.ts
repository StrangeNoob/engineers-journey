import * as THREE from "three";
import { describe, it, expect } from "vitest";
import { cameraRelativeMove, pickGait, resolveCollisions, gaitWeights, resolveClips, type Role } from "./gandalf";

describe("cameraRelativeMove", () => {
  it("forward with yaw 0 goes -Z", () => {
    const v = cameraRelativeMove(1, 0, 0);
    expect(v.x).toBeCloseTo(0); expect(v.z).toBeCloseTo(-1);
  });
  it("right with yaw 0 goes +X", () => {
    const v = cameraRelativeMove(0, 1, 0);
    expect(v.x).toBeCloseTo(1); expect(v.z).toBeCloseTo(0);
  });
  it("normalizes diagonal", () => {
    const v = cameraRelativeMove(1, 1, 0);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
});

describe("pickGait", () => {
  it("idle below walk threshold", () => { expect(pickGait(0.05, false)).toBe("idle"); });
  it("walk when moving, not running", () => { expect(pickGait(2, false)).toBe("walk"); });
  it("run when moving and run held", () => { expect(pickGait(2, true)).toBe("run"); });
});

describe("gaitWeights", () => {
  it("idle -> only idle", () => { expect(gaitWeights("idle")).toEqual({ idle: 1, walk: 0, run: 0 }); });
  it("walk -> only walk", () => { expect(gaitWeights("walk")).toEqual({ idle: 0, walk: 1, run: 0 }); });
  it("run -> only run", () => { expect(gaitWeights("run")).toEqual({ idle: 0, walk: 0, run: 1 }); });
});

describe("resolveCollisions", () => {
  const col = [{ x: 0, z: 0, r: 5 }];
  it("leaves a point outside the collider untouched", () => {
    const p = resolveCollisions(10, 0, col, 0.5);
    expect(p.x).toBeCloseTo(10); expect(p.z).toBeCloseTo(0);
  });
  it("pushes an overlapping point out to the surface (r + body radius)", () => {
    const p = resolveCollisions(3, 0, col, 0.5);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(5.5);
    expect(p.x).toBeGreaterThan(3); // pushed radially outward along +x
  });
  it("shoves a dead-centre point out instead of dividing by zero", () => {
    const p = resolveCollisions(0, 0, col, 0.5);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(5.5);
  });
});

const clip = (name: string) => new THREE.AnimationClip(name, -1, []);
const ROLES: Role[] = ["idle", "walk", "run", "wave", "listening"];

describe("resolveClips", () => {
  it("maps each role to its own clip when all are present", () => {
    const map = new Map(ROLES.map((r) => [r, clip(r)]));
    const got = resolveClips(ROLES, map);
    for (const r of ROLES) expect(got[r].name).toBe(r);
  });
  it("falls back to idle for any missing role", () => {
    const map = new Map([["idle", clip("idle")], ["walk", clip("walk")]]);
    const got = resolveClips(ROLES, map);
    expect(got.walk.name).toBe("walk");
    expect(got.run.name).toBe("idle");       // fallback
    expect(got.listening.name).toBe("idle"); // fallback
  });
  it("throws when idle is missing", () => {
    expect(() => resolveClips(ROLES, new Map([["walk", clip("walk")]]))).toThrow(/idle/i);
  });
});
