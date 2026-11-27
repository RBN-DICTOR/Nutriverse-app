import { useEffect, useState } from 'react';
import { CATEGORIES, NUTRIENTS, type NutrientKey } from '../data/foods';
import { PlateStage } from '../components/PlateStage';
import { go, Page, Quality, Swatch } from '../components/ui';
import { useTilt } from '../lib/motion';
import { fmt, isAllowed, portion } from '../lib/nutrition';
import { addToPlate, setState, useFoods, useStore } from '../lib/store';

export default function Explorer({ id }: { id?: string }) {
  const { cat } = useFoods();
  return id && cat[id] ? <Detail id={id} key={id} /> : <List />;
}

function List() {
  const { foods } = useFoods();
  const { prices, currency } = useStore();
  const tilt = useTilt(8);
  const [q, setQ] = useState(''), [category, setCategory] = useState(''), [nutrient, setNutrient] = useState<NutrientKey | ''>('');
  const [diet, setDiet] = useState(''), [prep, setPrep] = useState(''), [sort, setSort] = useState('name');
  const n = NUTRIENTS.find(x => x.key === nutrient);
  const price = (id: string) => prices[id]?.perKg ?? Infinity;
  const list = foods.filter(f => (!category || f.category === category) && (!diet || (diet === 'vegan' ? f.diet === 'vegan' : f.diet !== 'any'))
    && (!prep || f.rawOrCooked === prep) && (!nutrient || f.nutrients[nutrient] !== null)
    && [f.name, ...f.alternativeNames, ...f.regionalNames].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'cost' ? price(a.id) - price(b.id) || a.name.localeCompare(b.name) : nutrient ? b.nutrients[nutrient]! - a.nutrients[nutrient]! : a.name.localeCompare(b.name));
  return (
    <Page eyebrow="Food Explorer" title="Know your food" intro="Search by English or local name. Availability filtering will appear once verified local availability data exists.">
      <div className="filters">
        <input type="search" placeholder="Search beans, mtama, terere…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search foods" />
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Food group"><option value="">All food groups</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <select value={nutrient} onChange={e => setNutrient(e.target.value as NutrientKey)} aria-label="Rank by nutrient"><option value="">Rank by nutrient…</option>{NUTRIENTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        <select value={diet} onChange={e => setDiet(e.target.value)} aria-label="Food type"><option value="">Any food type</option><option value="vegetarian">Vegetarian</option><option value="vegan">Plant-only</option></select>
        <select value={prep} onChange={e => setPrep(e.target.value)} aria-label="Preparation"><option value="">Any preparation state</option><option value="cooked">Cooked</option><option value="raw">Raw or dry</option><option value="ready-to-eat">Ready to eat</option></select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="name">Sort: standard</option><option value="cost">Sort: your price, lowest first</option></select>
      </div>
      <p className="fine">{list.length} foods{n ? `, ranked by ${n.label.toLowerCase()} per 100 g. Foods with no data are hidden, not ranked as zero.` : ''}</p>
      <div className="tiles">
        {list.map(f => <button key={f.id} className="tilt-card" {...tilt} onClick={() => go(`/food/${f.id}`)}><Swatch food={f} size={76} /><b>{f.name}</b><span>{n ? `${fmt(f.nutrients[n.key], n.unit)} / 100 g` : f.category}</span>{sort === 'cost' && <span>{prices[f.id] ? `${currency} ${prices[f.id].perKg}/kg` : 'No price entered'}</span>}</button>)}
      </div>
      {!list.length && <p className="empty">Nothing matches. Try clearing a filter.</p>}
    </Page>
  );
}

function Detail({ id }: { id: string }) {
  const { cat } = useFoods();
  const { prefs } = useStore();
  const f = cat[id];
  useEffect(() => { setState(s => (s.explored.includes(id) ? {} : { explored: [...s.explored, id] })); }, [id]);
  const allowed = isAllowed(f, prefs);
  return (
    <Page eyebrow={f.category} title={f.name} intro={f.description} actions={<><button className="btn outline" onClick={() => go('/explore')}>All foods</button><button className="btn" disabled={!allowed} onClick={() => { addToPlate(f); go('/build'); }}>Add to Plate</button></>}>
      {!allowed && <p className="warn">This food conflicts with your diet, allergy or avoid settings.</p>}
      <div className="split">
        <div>
          <div className="detail-stage"><PlateStage key={f.id} detailFood={f} turntable items={[{ uid: 'solo-' + f.id, foodId: f.id, grams: f.defaultServingGrams, pos: { x: 0, z: 0 } }]} cat={cat} label={`3D model of ${f.name} on a pedestal with orbiting nutrient orbs`} /></div>
          <p className="fine">Orb size is proportional to grams per 100 g.</p>
        </div>
        <div className="card">
          <div className="row between"><h3>Nutrition</h3><Quality food={f} /></div>
          <table><thead><tr><th>Nutrient</th><th>Per 100 g</th><th>Per serving</th></tr></thead>
            <tbody>{NUTRIENTS.map(n => <tr key={n.key}><th>{n.label}</th><td>{fmt(f.nutrients[n.key], n.unit)}</td><td>{fmt(portion(f, f.defaultServingGrams, n.key), n.unit)}</td></tr>)}</tbody></table>
          <p className="fine">Serving: {f.servingDescription}. Basis: 100 g edible, {f.preparationMethod.toLowerCase()} ({f.rawOrCooked}).</p>
        </div>
      </div>
      <div className="grid3">
        <div className="card"><h3>How people use it</h3><p>{f.uses}</p>{f.regionalNames.length > 0 && <p className="fine">Local names: {f.regionalNames.join(', ')}. Recipes and varieties differ by place.</p>}{f.allergens.length > 0 && <p className="warn">Contains: {f.allergens.join(', ')}</p>}</div>
        <div className="card"><h3>Goes well with</h3><div className="chips">{f.related.map(r => <button key={r} onClick={() => go(`/food/${r}`)}><Swatch food={cat[r]} size={22} />{cat[r].name}</button>)}</div></div>
        <div className="card"><h3>About this record</h3><p className="fine"><b>Source:</b> {f.sourceName}<br /><b>Reference:</b> {f.sourceReference}<br /><b>Updated:</b> {f.lastUpdated}<br /><b>Limitations:</b> {f.limitations}<br />{f.countryOrRegion}</p></div>
      </div>
    </Page>
  );
}
