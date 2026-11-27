import { useState } from 'react';
import { MACROS, MICROS, REFERENCES } from '../data/learn';
import { NUTRIENTS } from '../data/foods';
import { Bars, go, Page } from '../components/ui';
import { useFoods } from '../lib/store';

const ANIMAL = ['Animal-source foods', 'Dairy'];
const SYMBOLS = ['Cb', 'Pr', 'Ft', 'Fb', 'Fe', 'A', 'C', 'D', 'B12', 'B9', 'Ca', 'Zn', 'K', 'I'];

export default function Lab() {
  const { foods } = useFoods();
  const [name, setName] = useState('Iron');
  const micro = MICROS.find(m => m.name === name);
  const macro = MACROS.find(m => m.name === name);
  const key = (micro ?? macro)!.key;
  const unit = NUTRIENTS.find(n => n.key === key)!.unit;
  const ranked = foods.filter(f => (f.nutrients[key] ?? 0) > 0 && !['maizeflour', 'sorghum', 'cassava'].includes(f.id)).sort((a, b) => b.nutrients[key]! - a.nutrients[key]!);
  const rows = (list: typeof ranked) => list.slice(0, 6).map(f => ({ label: f.name, value: f.nutrients[key], color: f.look.color }));
  const plant = ranked.filter(f => !ANIMAL.includes(f.category) && f.group !== 'mixed'), animal = ranked.filter(f => ANIMAL.includes(f.category));
  const unknown = foods.filter(f => f.nutrients[key] === null).length;
  return (
    <Page eyebrow="Nutrition Lab" title="Make nutrients visible" intro="Pick an element and see where it comes from.">
      <div className="periodic">
        {[...MACROS, ...MICROS].map((m, i) => <button key={m.name} className={name === m.name ? 'on' : ''} onClick={() => setName(m.name)}><small>{i + 1}</small><b>{SYMBOLS[i]}</b><span>{m.name}</span></button>)}
      </div>
      <div className="split">
        <div className="card">
          <h2>{name}</h2>
          {macro && <ul>{macro.text.map(t => <li key={t}>{t}</li>)}</ul>}
          {micro && <><p><b>What it does.</b> {micro.role}</p><p><b>If intake is low.</b> {micro.low}</p><p><b>In meals.</b> {micro.pair}</p><p><a href={micro.ref} target="_blank" rel="noreferrer">Reference: NIH Office of Dietary Supplements ↗</a></p></>}
          <p className="fine">Food choices or a photo cannot diagnose a deficiency. See a qualified health professional about concerns.</p>
        </div>
        <div className="card">
          <h3>Plant sources per 100 g</h3>{plant.length ? <Bars unit={unit} rows={rows(plant)} /> : <p className="empty">No values in this catalogue.</p>}
          <h3>Animal sources per 100 g</h3>{animal.length ? <Bars unit={unit} rows={rows(animal)} /> : <p className="empty">No values in this catalogue.</p>}
          <p className="fine">{unknown} foods have no data for {name.toLowerCase()} and are not shown. Amount in food is not the same as amount absorbed.</p>
          <div className="chips">{ranked.slice(0, 4).map(f => <button key={f.id} onClick={() => go(`/food/${f.id}`)}>Open {f.name}</button>)}</div>
        </div>
      </div>
      <Versus />
      <p className="fine">Further reading: {REFERENCES.map(([t, u]) => <a key={u} href={u} target="_blank" rel="noreferrer">{t} ↗ </a>)}</p>
    </Page>
  );
}

function Versus() {
  const { foods, cat } = useFoods();
  const [a, setA] = useState('beans'), [b, setB] = useState('fish'), [grams, setGrams] = useState(100);
  return (
    <div className="card">
      <h2>Food versus food</h2>
      <div className="row wrap">
        {[[a, setA], [b, setB]].map(([v, set], i) => <select key={i} aria-label={`Food ${i + 1}`} value={v as string} onChange={e => (set as (x: string) => void)(e.target.value)}>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>)}
        <label className="grams"><input type="number" min={1} value={grams} onChange={e => setGrams(Math.max(1, +e.target.value))} />g of each</label>
      </div>
      <div className="portion-visual" aria-label="Portion illustration">{[a, b].map((id, i) => <figure key={i}><span style={{ width: 40 + Math.cbrt(grams) * 16, height: 40 + Math.cbrt(grams) * 16, background: cat[id].look.color }} /><figcaption>{grams} g {cat[id].name}<br /><small>illustration, not to scale</small></figcaption></figure>)}</div>
      <div className="grid2">{(['energyKcal', 'proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fibreGrams', 'ironMg'] as const).map(k => { const n = NUTRIENTS.find(x => x.key === k)!; return <div key={k}><h4>{n.label}</h4><Bars unit={n.unit} rows={[a, b].map(id => ({ label: cat[id].name, color: cat[id].look.color, value: cat[id].nutrients[k] === null ? null : cat[id].nutrients[k]! * grams / 100 }))} /></div>; })}</div>
    </div>
  );
}
