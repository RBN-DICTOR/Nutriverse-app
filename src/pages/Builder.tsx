import { useRef, useState } from 'react';
import { PlateStage, type StageHandle } from '../components/PlateStage';
import { go, Indicator, NutritionPanel, PlateGuide, Quality, Swatch } from '../components/ui';
import { addToPlate, SAMPLE, saveMeal, setPlate, uid, undo, useFoods, useStore } from '../lib/store';
import { alternatives, fmt, isAllowed, portion } from '../lib/nutrition';
import type { Food } from '../data/foods';

const FILTERS = [['all', 'All'], ['staple', 'Staples'], ['protein', 'Protein'], ['vegfruit', 'Veg & fruit'], ['mixed', 'Dishes'], ['extra', 'Extras']];

export default function Builder() {
  const { plate, history, prefs } = useStore();
  const { foods, cat } = useFoods();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [tab, setTab] = useState<'meal' | 'nutrition' | 'guide'>('meal');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [swaps, setSwaps] = useState(false);
  const [matched, setMatched] = useState(false);
  const stage = useRef<StageHandle>(null);
  const item = plate.find(i => i.uid === sel && cat[i.foodId]);
  const food = item ? cat[item.foodId] : null;
  const shelf = foods.filter(f => (group === 'all' || f.group === group) && [f.name, ...f.alternativeNames, ...f.regionalNames].join(' ').toLowerCase().includes(q.toLowerCase()));
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(m => (m === t ? '' : m)), 3500); };

  const add = (f: Food, pos?: { x: number; z: number }) => {
    if (!isAllowed(f, prefs)) return say(`${f.name} conflicts with your diet, allergy or avoid list. Change this in Settings.`);
    if (plate.length >= 14) return say('The plate is full. Remove a food first.');
    setSel(addToPlate(f, f.defaultServingGrams, pos));
    say(f.id === 'cassava' ? 'Cassava added using raw reference weight. Never eat it raw.' : `${f.name} added.`);
  };
  const setGrams = (grams: number) => item && setPlate(plate.map(i => (i.uid === item.uid ? { ...i, grams: Math.min(2000, Math.max(1, grams || 1)) } : i)));
  const remove = (id: string) => { setPlate(plate.filter(i => i.uid !== id)); setSel(null); };
  const unit = food?.gramsPerMl ? 'ml' : 'g';
  const shown = item && food ? Math.round(item.grams / (food.gramsPerMl ?? 1)) : 0;

  return (
    <main className="builder">
      <aside className="shelf" aria-label="Food library">
        <h2>Pantry shelf</h2>
        <input type="search" placeholder="Search ugali, ndengu…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search foods" />
        <div className="chips scroll">{FILTERS.map(([k, l]) => <button key={k} className={group === k ? 'on' : ''} onClick={() => setGroup(k)}>{l}</button>)}</div>
        <ul>
          {shelf.map(f => (
            <li key={f.id}>
              <button draggable onDragStart={e => e.dataTransfer.setData('text/food', f.id)} onClick={() => add(f)} className={isAllowed(f, prefs) ? '' : 'blocked'} aria-label={`Add ${f.name}`}>
                <Swatch food={f} size={38} /><span><b>{f.name}</b><small>{isAllowed(f, prefs) ? f.servingDescription : 'Excluded by your settings'}</small></span><i>+</i>
              </button>
            </li>
          ))}
          {!shelf.length && <li className="empty">No food matches that search.</li>}
        </ul>
      </aside>

      <section className="table">
        <PlateStage
          ref={stage}
          items={plate}
          cat={cat}
          selected={sel}
          emptyGhost={!plate.length}
          onSelect={setSel}
          onCompassComplete={setMatched}
          onMove={(id, x, z) => setPlate(plate.map(i => (i.uid === id ? { ...i, pos: { x, z } } : i)))}
          onDropFood={(id, pos) => cat[id] && add(cat[id], pos)}
        />
        {!plate.length && <div className="plate-empty"><h3>An empty plate, full of possibility</h3><p>Drop a food here, or tap one on the shelf.</p><button className="btn lime" onClick={() => setPlate(SAMPLE.map(i => ({ ...i })))}>Load ugali, beans and sukuma wiki</button></div>}
        <div className="cam" role="toolbar" aria-label="Camera controls">
          <button onClick={() => stage.current?.rotate(-0.5)} aria-label="Rotate left">⟲</button>
          <button onClick={() => stage.current?.rotate(0.5)} aria-label="Rotate right">⟳</button>
          <button onClick={() => stage.current?.zoom(0.82)} aria-label="Zoom in">＋</button>
          <button onClick={() => stage.current?.zoom(1.2)} aria-label="Zoom out">－</button>
          <button onClick={() => stage.current?.view('top')}>Top</button>
          <button onClick={() => stage.current?.view('close')} disabled={!item}>Focus</button>
          <button onClick={() => stage.current?.view('full')}>Reset view</button>
        </div>
        {matched && plate.length > 0 && <div className="matched-cue" role="status"><span className="badge matched-badge">Plate matched</span></div>}
        <div className="toast" role="status" key={msg}>{msg}</div>
        {item && food && (
          <div className="portion">
            <div className="row between"><div className="row"><Swatch food={food} size={34} /><div><b>{food.name}</b><small>{food.preparationMethod} · {food.rawOrCooked}</small></div></div><button className="x" onClick={() => setSel(null)} aria-label="Close">✕</button></div>
            <div className="row">
              <input type="range" min={5} max={Math.max(600, Math.ceil(food.defaultServingGrams * 3))} step={5} value={item.grams} onChange={e => setGrams(+e.target.value)} aria-label="Portion size" />
              <label className="grams"><input type="number" min={1} value={shown} onChange={e => setGrams(+e.target.value * (food.gramsPerMl ?? 1))} />{unit}</label>
            </div>
            <div className="chips">
              <button onClick={() => setGrams(food.defaultServingGrams)}>{food.servingDescription}</button>
              {food.presets.map(p => <button key={p.label} onClick={() => setGrams(p.grams)}>{p.label} ({p.grams} g)</button>)}
              {[50, 100, 150].map(g => <button key={g} onClick={() => setGrams(g * (food.gramsPerMl ?? 1))}>{g} {unit}</button>)}
            </div>
            <p className="fine">This portion: {fmt(portion(food, item.grams, 'energyKcal'), 'kcal')} · protein {fmt(portion(food, item.grams, 'proteinGrams'), 'g')} · fibre {fmt(portion(food, item.grams, 'fibreGrams'), 'g')}. Model size is only a visual cue. No scale? A cupped handful or cup is only a rough guide.</p>
            <div className="row"><Quality food={food} /><button className="link" onClick={() => go(`/food/${food.id}`)}>Food details</button><button className="link danger" onClick={() => remove(item.uid)}>Remove</button></div>
          </div>
        )}
      </section>

      <aside className="panel" aria-label="Meal details">
        <div className="tabs" role="tablist">{(['meal', 'nutrition', 'guide'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'meal' ? `Meal (${plate.length})` : t === 'guide' ? 'Compass' : 'Nutrition'}</button>)}</div>
        <div className="panel-body">
          {tab === 'meal' && <>
            <ul className="meal-list">
              {plate.filter(i => cat[i.foodId]).map(i => <li key={i.uid} className={sel === i.uid ? 'on' : ''}><button onClick={() => setSel(i.uid)}><Swatch food={cat[i.foodId]} size={30} /><span><b>{cat[i.foodId].name}</b><small>{Math.round(i.grams / (cat[i.foodId].gramsPerMl ?? 1))} {cat[i.foodId].gramsPerMl ? 'ml' : 'g'} · {fmt(portion(cat[i.foodId], i.grams, 'energyKcal'), 'kcal')}</small></span></button><button className="x" aria-label={`Remove ${cat[i.foodId].name}`} onClick={() => remove(i.uid)}>✕</button></li>)}
            </ul>
            <div className="row wrap">
              <button className="btn sm outline" onClick={undo} disabled={!history.length}>Undo</button>
              <button className="btn sm outline" onClick={() => { setPlate([]); setSel(null); }} disabled={!plate.length}>Clear plate</button>
              <button className="btn sm outline" onClick={() => { setPlate(plate.map(({ pos, ...i }) => ({ ...i, grams: cat[i.foodId].defaultServingGrams }))); say('Portions and positions reset.'); }} disabled={!plate.length}>Reset portions</button>
            </div>
            <label className="field">Meal name<input value={name} onChange={e => setName(e.target.value)} placeholder="Sunday lunch" /></label>
            <div className="row wrap">
              <button className="btn sm" disabled={!plate.length} onClick={() => { saveMeal(name, plate); setName(''); say('Meal saved.'); }}>Save meal</button>
              <button className="btn sm outline" disabled={!plate.length} onClick={() => { saveMeal(`${name || 'My meal'} (copy)`, plate.map(i => ({ ...i, uid: uid() }))); say('Duplicate saved. Edit the plate, then compare.'); }}>Duplicate meal</button>
              <button className="btn sm outline" onClick={() => go('/compare')}>Compare meals</button>
              <button className="btn sm outline" disabled={!food} onClick={() => setSwaps(!swaps)}>Generate alternatives</button>
              <button className="btn sm outline" disabled={!plate.length} onClick={() => setTab('nutrition')}>Nutrition breakdown</button>
            </div>
            {!food && plate.length > 0 && <p className="fine">Select a food to see alternatives.</p>}
            {swaps && food && item && <div className="swaps"><h4>Swap {food.name} for</h4>{alternatives(food, foods, prefs).map(a => <button key={a.id} onClick={() => { setPlate(plate.map(i => (i.uid === item.uid ? { ...i, foodId: a.id, grams: a.defaultServingGrams } : i))); setSwaps(false); say(`Swapped to ${a.name}. Same plate group, different nutrients.`); }}><Swatch food={a} size={24} />{a.name}</button>)}<p className="fine">Same plate group does not mean nutritionally identical. Check the numbers.</p></div>}
          </>}
          {tab === 'nutrition' && <NutritionPanel items={plate} cat={cat} />}
          {tab === 'guide' && <><PlateGuide items={plate} cat={cat} /><Indicator items={plate} cat={cat} /></>}
        </div>
      </aside>
    </main>
  );
}
