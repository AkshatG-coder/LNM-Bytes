import { useCallback, useRef } from "react";

/**
 * useOrderSound — stable ref-based hook.
 * Returns a play() function whose identity never changes between renders,
 * so it can be safely used inside useCallback deps without creating loops.
 */
export function useOrderSound() {
  // Keep the implementation in a ref so the returned callback is always stable
  const playRef = useRef(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Ding — high note
      const ding     = ctx.createOscillator();
      const dingGain = ctx.createGain();
      ding.connect(dingGain);
      dingGain.connect(ctx.destination);
      ding.type = "sine";
      ding.frequency.setValueAtTime(880, ctx.currentTime);         // A5
      dingGain.gain.setValueAtTime(0.6, ctx.currentTime);
      dingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      ding.start(ctx.currentTime);
      ding.stop(ctx.currentTime + 0.4);

      // Dong — lower note, delayed
      const dong     = ctx.createOscillator();
      const dongGain = ctx.createGain();
      dong.connect(dongGain);
      dongGain.connect(ctx.destination);
      dong.type = "sine";
      dong.frequency.setValueAtTime(660, ctx.currentTime + 0.35);  // E5
      dongGain.gain.setValueAtTime(0.5, ctx.currentTime + 0.35);
      dongGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
      dong.start(ctx.currentTime + 0.35);
      dong.stop(ctx.currentTime + 0.85);

      setTimeout(() => ctx.close(), 1500);
    } catch {
      // AudioContext blocked or unsupported — fail silently
    }
  });

  // Stable function — same reference across ALL renders ✅
  const playNewOrderAlert = useCallback(() => {
    playRef.current();
  }, []); // empty deps = created once, never changes

  return { playNewOrderAlert };
}
