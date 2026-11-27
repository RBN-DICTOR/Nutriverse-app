import { useState } from 'react';
import { PlateStage } from '../components/PlateStage';
import { Bars, go, Page } from '../components/ui';
import { NUTRIENTS } from '../data/foods';
import { fmt, mealTotals, plateShares, type MealItem } from '../lib/nutrition';
import { cost } from '../lib/planner';
import { SAMPLE, SAMPLE_B, useFoods, useStore } from '../lib/store';

export default function Compare() {
  const { meals, plate, prices, currency } = useStore();
  const { cat } = useFoods();
  const options: { id: string; name: string; items: MealItem[] }[] = [
    ...(plate.length ? [{ id: 'plate', name: 'Current plate', items: plate }] : []),
    ...meals,
    { id: 'sa', name: 'Sample: ugali, beans, sukuma wiki', items: SAMPLE },
    { id: 'sb', name: 'Sample: rice, tilapia, vegetables', items: SAMPLE_B },
  ];
  const [picked, setPicked] = useState(['sa', 'sb']);
  const chosen = picked.map(id => options.find(o => o.id === id) ?? options[0]);
  const letters = ['A', 'B', 'C'], colors = ['#2f8f5b', '#f08a3c', '#d9503f'];
  const totals = chosen.map(m => mealTotals(m.items, cat));
  const keys = ['energyKcal', 'proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fibreGrams', 'ironMg', 'calciumMg', 'vitaminCMg', 'vitaminAUg', 'folateUg'] as const;

  const explain = keys.slice(0, 5).map(k => {
    const n = NUTRIENTS.find(x => x.key === k)!;
    if (totals.some(t => !t[k].complete)) return `${n.label}: some data is missing, so we do not rank these meals.`;
    const v = totals.map(t => t[k].value ?? 0), hi = v.indexOf(Math.max(...v)), lo = v.indexOf(Math.min(...v));
    return v[hi] - v[lo] <= v[hi] * 0.1 ? `${n.label}: the meals are similar at these portions.` : `${n.label}: Meal ${letters[hi]} has more (about ${fmt(v[hi], n.unit)} against ${fmt(v[lo], n.unit)} in Meal ${letters[lo]}).`;
  });

  return (
    <Page eyebrow="Compare My Meals" title="Side by side, without judgement" intro="More is not automatically better. What suits you depends on your needs, portions, preferences and context." actions={<>{picked.length < 3 ? <button className="btn outline" onClick={() => setPicked([...picked, options[0].id])}>Add a third meal</button> : <button className="btn outline" onClick={() => setPicked(picked.slice(0, 2))}>Remove third</button>}<button className="btn" onClick={() => go('/build')}>Build a meal</button></>}>
      <div className={picked.length === 3 ? 'grid3' : 'grid2'}>
        {chosen.map((m, i) => { const c = cost(m.items, cat, prices); const groups = new Set(m.items.map(x => cat[x.foodId]?.category)); return (
          <div className="card" key={i}>
            <h3 style={{ color: colors[i] }}>Meal {letters[i]}</h3>
            <select aria-label={`Choose meal ${letters[i]}`} value={m.id} onChange={e => setPicked(picked.map((p, j) => (j === i ? e.target.value : p)))}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <div className="mini-stage"><PlateStage key={m.id} items={m.items} cat={cat} tiltPointer bobPhase={i * 2.1} label={`3D view of meal ${letters[i]}`} /></div>
            <p>{m.items.filter(x => cat[x.foodId]).map(x => `${cat[x.foodId].name} ${Math.round(x.grams)} g`).join(' · ')}</p>
            <p className="fine"><b>{groups.size}</b> food categories · veg and fruit {Math.round(plateShares(m.items, cat).shares.vegfruit * 100)}% of guide weight<br />Estimated cost: {c.complete ? `${currency} ${c.known.toFixed(0)} (from your prices)` : 'unavailable until all ingredient prices are entered'}</p>
          </div>); })}
      </div>
      <div className="card reveal"><h2 className="reveal">In plain words</h2><ul>{explain.map(t => <li key={t}>{t}</li>)}</ul></div>
      <div className="grid2">{keys.map(k => { const n = NUTRIENTS.find(x => x.key === k)!; return <div className="card" key={k}><h4>{n.label}{totals.some(t => !t[k].complete) && <small> · incomplete data shown as a minimum</small>}</h4><Bars unit={n.unit} rows={totals.map((t, i) => ({ label: `Meal ${letters[i]}`, value: t[k].value, color: colors[i] }))} /></div>; })}</div>
    </Page>
  );
}
