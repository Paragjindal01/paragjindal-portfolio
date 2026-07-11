import { useCallback, useEffect, useRef } from 'react';

/**
 * Drives verified transform-level animations on the Spline robot.
 *
 * The scene (prod.spline.design/wmlbgIVajKF3kFwY) exposes NO Spline
 * variables or named animation events — verified via getVariables() and
 * scene inspection. What it does support (verified live in the runtime):
 *   - findObjectByName('ARM_R')  → rotation.z renders a raised-arm wave
 *   - findObjectByName('Mouth')  → scale pulses render mouth movement
 *
 * For deeper, scene-authored animation (true lip sync, eased wave), the
 * .spline file would need explicit states/events added in the Spline
 * editor (e.g. RobotWave, RobotSpeakStart) — see project README notes.
 *
 * All movement here is additive-and-restorative: original transforms are
 * captured before animating and restored after, so the scene's built-in
 * cursor-follow interaction is never broken.
 */
export default function useSplineRobotActions(splineRef, { reducedMotion = false } = {}) {
  const rafRef = useRef(0);
  const baseRef = useRef(null); // captured original transforms
  const talkingRef = useRef(false);

  const getObjects = useCallback(() => {
    const app = splineRef.current;
    if (!app || typeof app.findObjectByName !== 'function') return null;
    try {
      const armR = app.findObjectByName('ARM_R');
      const mouth = app.findObjectByName('Mouth');
      if (!armR && !mouth) return null;
      return { armR, mouth };
    } catch {
      return null;
    }
  }, [splineRef]);

  const captureBase = useCallback(() => {
    if (baseRef.current) return baseRef.current;
    const objs = getObjects();
    if (!objs) return null;
    baseRef.current = {
      armZ: objs.armR ? objs.armR.rotation.z : 0,
      mouthScale: objs.mouth
        ? { x: objs.mouth.scale.x, y: objs.mouth.scale.y, z: objs.mouth.scale.z }
        : null,
    };
    return baseRef.current;
  }, [getObjects]);

  const stopRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const restore = useCallback(() => {
    stopRaf();
    talkingRef.current = false;
    const objs = getObjects();
    const base = baseRef.current;
    if (!objs || !base) return;
    if (objs.armR) objs.armR.rotation.z = base.armZ;
    if (objs.mouth && base.mouthScale) {
      objs.mouth.scale.x = base.mouthScale.x;
      objs.mouth.scale.y = base.mouthScale.y;
      objs.mouth.scale.z = base.mouthScale.z;
    }
  }, [getObjects]);

  /** Raise the right arm and wave it briefly, then hand off to `onDone`. */
  const playWave = useCallback(
    (onDone) => {
      const objs = getObjects();
      const base = captureBase();
      if (reducedMotion || !objs?.armR || !base) {
        onDone?.();
        return;
      }
      stopRaf();
      const DURATION = 1800; // ms
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / DURATION, 1);
        // Ease arm up during first 25%, wave in middle, ease down in last 20%
        let lift;
        if (t < 0.25) lift = t / 0.25;
        else if (t > 0.8) lift = (1 - t) / 0.2;
        else lift = 1;
        const wave = t >= 0.25 && t <= 0.8 ? Math.sin((t - 0.25) * 22) * 0.16 : 0;
        objs.armR.rotation.z = base.armZ - lift * 0.9 + wave;
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          objs.armR.rotation.z = base.armZ;
          rafRef.current = 0;
          onDone?.();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [getObjects, captureBase, reducedMotion]
  );

  /** Subtle mouth pulse while speaking (not lip sync — a talking effect). */
  const startTalking = useCallback(() => {
    const objs = getObjects();
    const base = captureBase();
    if (reducedMotion || !objs?.mouth || !base?.mouthScale) return;
    if (talkingRef.current) return; // already talking
    talkingRef.current = true;
    stopRaf();
    const startTime = performance.now();
    const tick = (now) => {
      if (!talkingRef.current) return;
      const t = (now - startTime) / 1000;
      // Layered sines ≈ natural speech cadence, ±8% scale
      const pulse = 1 + 0.08 * Math.sin(t * 9.2) * (0.6 + 0.4 * Math.sin(t * 2.3));
      objs.mouth.scale.y = base.mouthScale.y * pulse;
      objs.mouth.scale.x = base.mouthScale.x * (2 - pulse * 0.98 > 1 ? 1 : 2 - pulse * 0.98);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [getObjects, captureBase, reducedMotion]);

  const stopTalking = useCallback(() => {
    if (!talkingRef.current) return;
    restore();
  }, [restore]);

  // Clean up on unmount: cancel frames and restore the robot's pose.
  useEffect(() => restore, [restore]);

  return { playWave, startTalking, stopTalking, resetPose: restore };
}
