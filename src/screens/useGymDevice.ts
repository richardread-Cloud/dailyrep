import { useCallback, useEffect, useRef } from 'react';

/**
 * Keeps the screen awake while mounted (Screen Wake Lock, re-requested when the app comes back to the front)
 * and gives a beep for the end of a rest. Browsers only allow both after the first tap, so call `unlock` from a tap handler.
 */
export function useGymDevice() {
  const lock = useRef<WakeLockSentinel | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const requestWake = useCallback(async () => {
    if (lock.current || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      lock.current = await navigator.wakeLock.request('screen');
      lock.current.addEventListener('release', () => { lock.current = null; });
    } catch { /* refused: the screen may sleep */ }
  }, []);

  const unlock = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AC) audio.current = new AC();
      if (audio.current?.state === 'suspended') void audio.current.resume();
    } catch { /* no sound */ }
    void requestWake();
  }, [requestWake]);

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    [0, 0.25, 0.5].forEach((t, n) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + t;
      o.frequency.value = n === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(at); o.stop(at + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  }, []);

  useEffect(() => {
    void requestWake();
    const vis = () => { if (document.visibilityState === 'visible') void requestWake(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      void lock.current?.release();
      lock.current = null;
    };
  }, [requestWake]);

  return { unlock, beep };
}
