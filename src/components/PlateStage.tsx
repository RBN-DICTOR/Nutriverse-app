import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PlateEngine, View } from '../three/PlateEngine';
import { layout } from '../lib/layout';
import type { Catalogue, MealItem } from '../lib/nutrition';

interface Props {
  items: MealItem[]; cat: Catalogue; hero?: boolean; floating?: string[]; selected?: string | null; label?: string;
  onSelect?: (uid: string | null) => void; onMove?: (uid: string, x: number, z: number) => void;
  onPlateClick?: () => void; onDropFood?: (foodId: string, pos?: { x: number; z: number }) => void;
}
export interface StageHandle { view: (v: View) => void; zoom: (f: number) => void; rotate: (a: number) => void }

export const PlateStage = forwardRef<StageHandle, Props>(function PlateStage(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<PlateEngine | null>(null);
  const latest = useRef(props); latest.current = props;
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let dead = false;
    // Lazy-load Three.js; any failure (network, WebGL) falls back to the 2D plate.
    import('../three/PlateEngine').then(({ PlateEngine }) => {
      if (dead || !host.current) return;
      const e = new PlateEngine(host.current, !!latest.current.hero, {
        onSelect: u => latest.current.onSelect?.(u),
        onMove: (u, x, z) => latest.current.onMove?.(u, x, z),
        onPlateClick: () => latest.current.onPlateClick?.(),
        onHover: (text, x, y) => setTip(text ? { text, x, y } : null),
      });
      engine.current = e;
      if (latest.current.floating) e.setFloating(latest.current.floating, latest.current.cat);
      e.setMeal(latest.current.items, latest.current.cat);
      setStatus('ready');
    }).catch(err => { console.warn('3D unavailable, using 2D plate.', err); if (!dead) setStatus('failed'); });
    return () => { dead = true; engine.current?.dispose(); engine.current = null; };
  }, []);

  useEffect(() => { engine.current?.setMeal(props.items, props.cat); }, [props.items, props.cat]);
  useEffect(() => { engine.current?.setSelected(props.selected ?? null); }, [props.selected, props.items]);
  useImperativeHandle(ref, () => ({
    view: v => engine.current?.setView(v), zoom: f => engine.current?.zoom(f), rotate: a => engine.current?.rotate(a),
  }), []);

  return (
    <div className="stage" role="group" aria-label={props.label ?? 'Interactive plate'}
      onDragOver={e => { if (props.onDropFood) e.preventDefault(); }}
      onDrop={e => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/food');
        if (!id) return;
        if (!engine.current) return props.onDropFood?.(id);
        const p = engine.current.pointOnPlate(e.clientX, e.clientY);
        if (p) props.onDropFood?.(id, p);
      }}>
      <div ref={host} className="stage-canvas" />
      {status === 'loading' && <div className="stage-note"><span className="spinner" />Setting the table…</div>}
      {status === 'failed' && <Plate2D {...props} />}
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
});

export function Plate2D({ items, cat, selected, onSelect, onPlateClick, hero }: Props) {
  const spots = layout(items, cat);
  return (
    <div className="fallback">
      <svg viewBox="-4.3 -4.3 8.6 8.6" role="img" aria-label="Top-down view of the plate">
        <circle r="4.15" fill="#b88f52" /><circle r="3.95" fill="none" stroke="#123b2a" strokeWidth=".18" strokeDasharray=".22 .1" />
        <circle r="3.5" fill="#f7f2e4" onClick={onPlateClick} /><circle r="3.05" fill="none" stroke="#d8d0bb" strokeWidth=".05" />
        {spots.map(s => {
          const f = cat[items.find(i => i.uid === s.uid)!.foodId];
          return (
            <g key={s.uid} transform={`translate(${s.x} ${s.z})`} tabIndex={0} role="button" aria-label={f.name}
              onClick={() => (hero ? onPlateClick?.() : onSelect?.(s.uid))} onKeyDown={e => e.key === 'Enter' && onSelect?.(s.uid)} style={{ cursor: 'pointer' }}>
              <circle r={s.r} fill={f.look.color} stroke={selected === s.uid ? '#123b2a' : f.look.accent} strokeWidth={selected === s.uid ? .14 : .08} />
              {[0, 1, 2, 3, 4, 5, 6].map(k => <circle key={k} cx={Math.cos(k * 2.4) * s.r * .12 * Math.sqrt(k * 3)} cy={Math.sin(k * 2.4) * s.r * .12 * Math.sqrt(k * 3)} r={s.r * .11} fill={f.look.accent} />)}
              <text y={s.r * .1} textAnchor="middle" fontSize=".27" fontWeight="700" fill="#202923" stroke="#fff8e9" strokeWidth=".09" paintOrder="stroke">{f.name.split(' (')[0]}</text>
            </g>
          );
        })}
      </svg>
      <p>2D plate view. 3D is not available on this device or browser.</p>
    </div>
  );
}
