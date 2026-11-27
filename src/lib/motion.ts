// Motion, accessibility, and subtle UI animation hooks.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export const MOTION_KEY = 'nutriverse:motion';
export type MotionSetting = 'auto' | 'reduce' | 'full';

export function getMotionSetting(): MotionSetting {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(MOTION_KEY);
    return v === 'reduce' || v === 'full' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function isMotionReduced(): boolean {
  const setting = getMotionSetting();
  if (setting === 'reduce') return true;
  if (setting === 'full') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function applyMotionAttribute() {
  if (typeof document === 'undefined') return;
  const setting = getMotionSetting();
  if (setting === 'auto') {
    delete document.documentElement.dataset.motion;
  } else {
    document.documentElement.dataset.motion = setting;
  }
}

export function setMotionSetting(next: MotionSetting) {
  if (typeof localStorage !== 'undefined') {
    try {
      if (next === 'auto') localStorage.removeItem(MOTION_KEY);
      else localStorage.setItem(MOTION_KEY, next);
    } catch { /* ignore storage restrictions */ }
  }
  applyMotionAttribute();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nutriverse:motion-change'));
  }
}

export function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const cores = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency
    : 8;
  return cores <= 4 || window.innerWidth < 600;
}

export function useMotionReduced(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => isMotionReduced());
  useEffect(() => {
    applyMotionAttribute();
    const sync = () => setReduced(isMotionReduced());
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    mq?.addEventListener('change', sync);
    window.addEventListener('nutriverse:motion-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      mq?.removeEventListener('change', sync);
      window.removeEventListener('nutriverse:motion-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return reduced;
}

/** Smoothly counts up/down to a target number (400 ms) while guaranteeing exact final equality. */
export function useCountUp(target: number | null, duration = 400): number | null {
  const reduced = useMotionReduced();
  const [shown, setShown] = useState<number | null>(target);
  const fromRef = useRef<number>(target ?? 0);

  useEffect(() => {
    if (target === null || !Number.isFinite(target) || reduced) {
      fromRef.current = target ?? 0;
      setShown(target);
      return;
    }
    const startVal = Number.isFinite(fromRef.current) ? fromRef.current : target;
    if (Math.abs(target - startVal) < 1e-6) {
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = startVal + (target - startVal) * eased;
      fromRef.current = cur;
      setShown(p >= 1 ? target : cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return reduced ? target : shown;
}

/** Subtle 3D pointer tilt (perspective 800px, max 8 deg) with soft moving highlight. Disabled on touch and reduced motion. */
export function useTilt(maxDeg = 8) {
  const reduced = useMotionReduced();
  const isTouch = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const active = !reduced && !isTouch;

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!active || e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - ny) * (maxDeg * 2);
    const ry = (nx - 0.5) * (maxDeg * 2);
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--hx', `${(nx * 100).toFixed(1)}%`);
    el.style.setProperty('--hy', `${(ny * 100).toFixed(1)}%`);
  }, [active, maxDeg]);

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    el.style.removeProperty('--hx');
    el.style.removeProperty('--hy');
  }, []);

  return active ? { onPointerMove, onPointerLeave } : {};
}

/** Scroll reveal hook that triggers .reveal / heading underline choreography and respects reduced motion. */
export function useReveal(routeKey: string) {
  const reduced = useMotionReduced();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('.reveal'));
    if (!targets.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(el => {
        el.classList.remove('pre');
        el.classList.add('seen');
      });
      return;
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('seen');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });

    targets.forEach(el => {
      if (!el.classList.contains('seen')) {
        el.classList.add('pre');
      }
      io.observe(el);
    });
    return () => io.disconnect();
  }, [routeKey, reduced]);
}
