import { useState, type ReactNode } from 'react';
import { NUTRIENTS, type Food, type NutrientKey } from '../data/foods';
import { useCountUp } from '../lib/motion';
import { compositionIndicator, fmt, fmtTotal, mealTotals, plateShares, portion, TARGET, type Catalogue, type MealItem, type Total } from '../lib/nutrition';

export const go = (path: string) => { location.hash = path; };

export function PlateLoader({ size = 28 }: { size?: number }) {
  return (
    <svg className="plate-loader" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(18,59,42,0.16)" strokeWidth="4" />
      <g fill="none" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 24 24)">
        <circle className="arc-g" cx="24" cy="24" r="18" stroke="#4DBB78" strokeDasharray="54.05 59.05" />
        <circle className="arc-t" cx="24" cy="24" r="18" stroke="#F16B59" strokeDasharray="25.77 87.33" strokeDashoffset="-56.55" />
        <circle className="arc-o" cx="24" cy="24" r="18" stroke="#FFA45B" strokeDasharray="25.77 87.33" strokeDashoffset="-84.82" />
      </g>
    </svg>
  );
}

export function Page({ eyebrow, title, intro, children, actions }: { eyebrow: string; title: string; intro?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="page">
      <header className="page-head">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{intro && <p className="lead">{intro}</p>}</div>
        {actions && <div className="row wrap">{actions}</div>}
      </header>
      <div className="sprout-divider" aria-hidden="true">
        <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
          <path d="M12 15V7" stroke="#123B2A" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 9C12 4.5 16.5 3 19 3C19 7 16 9 12 9Z" fill="#4DBB78" />
          <path d="M12 11.5C12 7.5 8 6 5 6.5C5 10 8 11.5 12 11.5Z" fill="#123B2A" />
        </svg>
      </div>
      {children}
    </main>
  );
}

export function Swatch({ food, size = 44 }: { food: Food; size?: number }) {
  return <span className="swatch" aria-hidden style={{ width: size, height: size, background: `radial-gradient(circle at 34% 30%, #ffffff99 0 6%, transparent 30%), radial-gradient(circle at 62% 64%, ${food.look.accent} 0 24%, transparent 26%), ${food.look.color}` }} />;
}

export const Quality = ({ food }: { food: Food }) => (
  <span className={`badge q-${food.dataQuality}`} title={food.limitations}>
    {food.dataQuality === 'verified' ? '✓ USDA verified' : food.dataQuality === 'calculated' ? 'Recipe estimate' : 'Provisional data'}
  </span>
);

export function Bars({ rows, unit }: { rows: { label: string; value: number | null; color?: string }[]; unit: string }) {
  const max = Math.max(1e-9, ...rows.map(r => r.value ?? 0));
  return (
    <ul className="bars">
      {rows.map((r, i) => (
        <li key={r.label + i} style={{ ['--i' as string]: i }}>
          <span>{r.label}</span>
          <span className="track">{r.value !== null && <i style={{ width: `${r.value / max * 100}%`, background: r.color ?? 'var(--fresh)' }} />}</span>
          <b>{fmt(r.value, unit)}</b>
        </li>
      ))}
    </ul>
  );
}

function CountPct({ pct }: { pct: number | null }) {
  const shown = useCountUp(pct, 400);
  return <>{shown === null ? '–' : `${Math.round(shown)}%`}</>;
}

export function PlateGuide({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const { shares, counted, mixed } = plateShares(items, cat);
  const rows = [['Vegetables and fruit', 'vegfruit', '#4dbb78'], ['Protein-rich', 'protein', '#f16b59'], ['Staples and grains', 'staple', '#ffa45b']] as const;
  const matched = counted > 0 && shares.vegfruit >= 0.45 && shares.protein >= 0.22 && shares.staple >= 0.22;
  return (
    <section>
      <div className="row between">
        <h3>Plate Compass</h3>
        {matched && <span className="badge matched-badge">Plate matched</span>}
      </div>
      {rows.map(([label, key, color]) => (
        <div className="compass-row" key={key}>
          <span><em style={{ background: color }} />{label}</span>
          <span className="track">{counted > 0 && <i style={{ width: `${shares[key] * 100}%`, background: color }} />}<u style={{ left: `${TARGET[key] * 100}%` }} /></span>
          <b><CountPct pct={counted ? Math.round(shares[key] * 100) : null} /></b>
        </div>
      ))}
      {mixed > 0 && <p className="fine">Mixed dishes are not split into guide groups, so they are left out of these shares.</p>}
      <p className="fine">The mark shows the illustrative guide: about ½ vegetables and fruit, ¼ protein, ¼ staples. Shares use weight as a stand-in for plate area. This is a teaching aid for general adults, not a prescription.</p>
    </section>
  );
}

export function Indicator({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const { score, checks } = compositionIndicator(items, cat);
  const shown = useCountUp(items.length ? score : null, 400);
  return (
    <details className="indicator">
      <summary><span>Composition indicator</span><b>{shown !== null ? `${Math.round(shown)}/100` : '–'}</b></summary>
      <ul>{checks.map(c => <li key={c.label}><span>{c.label}</span><b>{c.points}/{c.max}</b></li>)}</ul>
      <p className="fine">An educational checklist of variety and balance. It is not a medical or validated health score and does not judge a meal as healthy or unhealthy.</p>
    </details>
  );
}

function EmptyPlateGraphic() {
  return (
    <svg className="empty-plate-svg" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#FFFDF6" stroke="#123B2A" strokeOpacity="0.16" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="32" cy="32" r="22" fill="#F4ECD8" />
      <circle cx="32" cy="32" r="15" fill="#FFF8E9" stroke="#123B2A" strokeOpacity="0.12" strokeWidth="1.2" />
      <path d="M32 37V28" stroke="#123B2A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 31C32 25.5 36.5 23.5 39 23.5C39 28 36 31 32 31Z" fill="#4DBB78" />
      <path d="M32 34C32 29.5 28 28 25 28.5C25 32.5 28 34 32 34Z" fill="#123B2A" />
    </svg>
  );
}

function AnimatedTotal({ total, unit }: { total: Total; unit: string }) {
  const shown = useCountUp(total.value, 400);
  return <>{fmtTotal({ ...total, value: shown }, unit)}</>;
}

export function NutritionPanel({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const totals = mealTotals(items, cat);
  const [focus, setFocus] = useState<NutrientKey>('proteinGrams');
  const f = NUTRIENTS.find(n => n.key === focus)!;
  if (!items.length) {
    return (
      <div className="empty empty-box">
        <EmptyPlateGraphic />
        <p>Your plate is empty. Add a food to see its nutrition.</p>
      </div>
    );
  }
  const main: NutrientKey[] = ['proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fibreGrams'];
  const uses = [...new Set(items.map(i => cat[i.foodId]))];
  return (
    <section>
      <div className="energy"><b><AnimatedTotal total={totals.energyKcal} unit="kcal" /></b><span>estimated energy</span></div>
      <div className="macros">
        {main.map(k => { const n = NUTRIENTS.find(x => x.key === k)!; return (
          <button key={k} className={focus === k ? 'on' : ''} onClick={() => setFocus(k)}><span>{n.label}</span><b><AnimatedTotal total={totals[k]} unit={n.unit} /></b></button>
        ); })}
      </div>
      <label className="field">See each food’s contribution to
        <select value={focus} onChange={e => setFocus(e.target.value as NutrientKey)}>{NUTRIENTS.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}</select>
      </label>
      <Bars unit={f.unit} rows={items.map(i => ({ label: cat[i.foodId].name, value: portion(cat[i.foodId], i.grams, focus), color: cat[i.foodId].look.color }))} />
      <details><summary>All nutrients</summary>
        <table><tbody>{NUTRIENTS.map(n => <tr key={n.key}><th>{n.label}</th><td>{fmtTotal(totals[n.key], n.unit)}{!totals[n.key].complete && totals[n.key].value !== null && <small> ({totals[n.key].known} of {totals[n.key].count} foods)</small>}</td></tr>)}</tbody></table>
      </details>
      <p className="fine">“At least” means one or more foods have no data for that nutrient. Missing is not zero. Data: {uses.some(u => u.dataQuality !== 'verified') ? 'includes provisional or recipe estimates (see Settings to verify).' : 'USDA verified records.'}</p>
    </section>
  );
}
