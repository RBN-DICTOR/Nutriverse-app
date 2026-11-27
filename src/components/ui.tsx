import { useState, type ReactNode } from 'react';
import { NUTRIENTS, type Food, type NutrientKey } from '../data/foods';
import { compositionIndicator, fmt, fmtTotal, mealTotals, plateShares, portion, TARGET, type Catalogue, type MealItem } from '../lib/nutrition';

export const go = (path: string) => { location.hash = path; };

export function Page({ eyebrow, title, intro, children, actions }: { eyebrow: string; title: string; intro?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="page">
      <header className="page-head">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{intro && <p className="lead">{intro}</p>}</div>
        {actions && <div className="row">{actions}</div>}
      </header>
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
        <li key={r.label + i}>
          <span>{r.label}</span>
          <span className="track">{r.value !== null && <i style={{ width: `${r.value / max * 100}%`, background: r.color ?? 'var(--fresh)' }} />}</span>
          <b>{fmt(r.value, unit)}</b>
        </li>
      ))}
    </ul>
  );
}

export function PlateGuide({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const { shares, counted, mixed } = plateShares(items, cat);
  const rows = [['Vegetables and fruit', 'vegfruit', '#4dbb78'], ['Protein-rich', 'protein', '#f16b59'], ['Staples and grains', 'staple', '#ffa45b']] as const;
  return (
    <section>
      <h3>Plate Compass</h3>
      {rows.map(([label, key, color]) => (
        <div className="compass-row" key={key}>
          <span><em style={{ background: color }} />{label}</span>
          <span className="track">{counted > 0 && <i style={{ width: `${shares[key] * 100}%`, background: color }} />}<u style={{ left: `${TARGET[key] * 100}%` }} /></span>
          <b>{counted ? `${Math.round(shares[key] * 100)}%` : '–'}</b>
        </div>
      ))}
      {mixed > 0 && <p className="fine">Mixed dishes are not split into guide groups, so they are left out of these shares.</p>}
      <p className="fine">The mark shows the illustrative guide: about ½ vegetables and fruit, ¼ protein, ¼ staples. Shares use weight as a stand-in for plate area. This is a teaching aid for general adults, not a prescription.</p>
    </section>
  );
}

export function Indicator({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const { score, checks } = compositionIndicator(items, cat);
  return (
    <details className="indicator">
      <summary><span>Composition indicator</span><b>{items.length ? `${score}/100` : '–'}</b></summary>
      <ul>{checks.map(c => <li key={c.label}><span>{c.label}</span><b>{c.points}/{c.max}</b></li>)}</ul>
      <p className="fine">An educational checklist of variety and balance. It is not a medical or validated health score and does not judge a meal as healthy or unhealthy.</p>
    </details>
  );
}

export function NutritionPanel({ items, cat }: { items: MealItem[]; cat: Catalogue }) {
  const totals = mealTotals(items, cat);
  const [focus, setFocus] = useState<NutrientKey>('proteinGrams');
  const f = NUTRIENTS.find(n => n.key === focus)!;
  if (!items.length) return <p className="empty">Your plate is empty. Add a food to see its nutrition.</p>;
  const main: NutrientKey[] = ['proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fibreGrams'];
  const uses = [...new Set(items.map(i => cat[i.foodId]))];
  return (
    <section>
      <div className="energy"><b>{fmtTotal(totals.energyKcal, 'kcal')}</b><span>estimated energy</span></div>
      <div className="macros">
        {main.map(k => { const n = NUTRIENTS.find(x => x.key === k)!; return (
          <button key={k} className={focus === k ? 'on' : ''} onClick={() => setFocus(k)}><span>{n.label}</span><b>{fmtTotal(totals[k], n.unit)}</b></button>
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
