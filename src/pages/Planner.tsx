import { useState } from 'react';
import { go, Page, Swatch } from '../components/ui';
import { cost, eligible, generatePlan, planCost, scale, SHOP_GROUPS, shoppingList, TEMPLATES, times, toPurchasable, type Equipment, type PlanMeal, type Slot } from '../lib/planner';
import { alternatives, fmt, fmtTotal, mealTotals } from '../lib/nutrition';
import { setPlate, setState, uid, useFoods, useStore, type SavedPlan } from '../lib/store';

export default function Planner() {
  const s = useStore();
  const { foods, cat } = useFoods();
  const [budget, setBudget] = useState(s.plan?.budget?.toString() ?? '');
  const [mode, setMode] = useState('weekly');
  const [people, setPeople] = useState(s.plan?.people ?? 1);
  const [slots, setSlots] = useState<Slot[]>(['Breakfast', 'Lunch', 'Dinner']);
  const [snacks, setSnacks] = useState(false);
  const [pantry, setPantry] = useState<string[]>(s.plan?.pantry ?? []);
  const [equipment, setEquipment] = useState<Equipment>('stove');
  const [variety, setVariety] = useState(0);
  const [note, setNote] = useState('');
  const plan = s.plan;
  const update = (p: Partial<SavedPlan>) => setState(st => (st.plan ? { plan: { ...st.plan, ...p } } : {}));

  const generate = (days: number) => {
    const raw = parseFloat(budget);
    let limit: number | null = raw > 0 ? raw : null;
    if (limit !== null) {
      if (mode === 'daily') limit *= days;
      else if (mode === 'meal') limit *= days * people * (slots.length + (snacks ? 1 : 0));
      else limit *= days / 7;
    }
    if (!slots.length) return setNote('Choose at least one meal.');
    const r = generatePlan({ days, people, budget: limit, snacks, slots, pantry, equipment, prefs: s.prefs, variety }, cat, s.prices);
    setVariety(v => v + 1);
    setNote(r.emptySlots.length ? `No suitable ${r.emptySlots.join(', ')} option fits your restrictions and equipment. We left it empty rather than break a restriction.` : '');
    setState({ plan: { id: uid(), name: days === 1 ? 'Meal suggestions' : 'My week', date: new Date().toISOString(), days: r.days, people, budget: limit, currency: s.currency, location: [s.location.town, s.location.country].filter(Boolean).join(', '), pantry, bought: [], done: [] } });
  };

  const total = plan ? planCost(plan.days, cat, s.prices, plan.people, plan.pantry) : null;
  const list = plan ? shoppingList(plan.days, cat, s.prices, plan.people, plan.pantry) : [];
  const needed = [...new Set([...list.map(l => l.foodId), ...TEMPLATES.flatMap(t => t.items.flatMap(([id]) => toPurchasable(id, 1).map(p => p.foodId)))])];
  const money = (v: number) => `${s.currency} ${v.toFixed(0)}`;

  const replace = (d: number, m: number, meal: PlanMeal) => update({ days: plan!.days.map((day, i) => i !== d ? day : { ...day, meals: day.meals.map((x, j) => (j === m ? meal : x)) }) });

  const exportList = () => {
    const text = [`NutriVerse shopping list: ${plan!.days.length} day(s), ${plan!.people} person(s)`, 'Quantities are approximate (cooked-to-bought conversion).',
      ...SHOP_GROUPS.flatMap(g => { const rows = list.filter(l => l.group === g); return rows.length ? ['', g.toUpperCase(), ...rows.map(l => `[${l.have || plan!.bought.includes(l.foodId) ? 'x' : ' '}] ${l.name}: ~${Math.ceil(l.buyGrams / 10) * 10} g  ${l.have ? '(have it)' : l.cost === null ? 'cost unavailable' : money(l.cost)}`)] : []; }),
      '', total!.complete ? `Estimated cost of quantities used: ${money(total!.known)}` : `Priced items only: ${money(total!.known)}. ${total!.missing.length} items have no price.`].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'nutriverse-shopping-list.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Page eyebrow="Eat Well on a Budget" title="A week that fits your pocket" intro="Everything except your meals is optional. Prices are yours: NutriVerse never invents them.">
      <div className="card form">
        <label className="field">Country<input value={s.location.country} onChange={e => setState({ location: { ...s.location, country: e.target.value } })} /></label>
        <label className="field">Region or town<input value={s.location.town} placeholder="optional" onChange={e => setState({ location: { ...s.location, town: e.target.value } })} /></label>
        <label className="field">Currency<input value={s.currency} maxLength={5} onChange={e => setState({ currency: e.target.value })} /></label>
        <label className="field">Budget<input type="number" min={0} value={budget} placeholder="optional" onChange={e => setBudget(e.target.value)} /></label>
        <label className="field">Budget type<select value={mode} onChange={e => setMode(e.target.value)}><option value="weekly">Household, per week</option><option value="daily">Household, per day</option><option value="meal">Per person, per meal</option></select></label>
        <label className="field">People<input type="number" min={1} max={20} value={people} onChange={e => setPeople(Math.min(20, Math.max(1, +e.target.value)))} /></label>
        <label className="field">Cooking equipment<select value={equipment} onChange={e => setEquipment(e.target.value as Equipment)}><option value="stove">I can cook (stove, jiko or similar)</option><option value="none">No cooking</option></select></label>
        <fieldset><legend>Meals</legend>{(['Breakfast', 'Lunch', 'Dinner'] as Slot[]).map(x => <label key={x}><input type="checkbox" checked={slots.includes(x)} onChange={() => setSlots(slots.includes(x) ? slots.filter(y => y !== x) : [...slots, x])} />{x}</label>)}<label><input type="checkbox" checked={snacks} onChange={e => setSnacks(e.target.checked)} />Snacks</label></fieldset>
        <details className="full"><summary>Foods I already have ({pantry.length})</summary><div className="chips">{foods.filter(f => !['ugali', 'githeri', 'mukimo'].includes(f.id)).map(f => <button key={f.id} className={pantry.includes(f.id) ? 'on' : ''} onClick={() => setPantry(pantry.includes(f.id) ? pantry.filter(x => x !== f.id) : [...pantry, f.id])}>{f.name}</button>)}</div></details>
        <p className="full fine">Diet, allergies and foods to avoid come from <button className="link" onClick={() => go('/settings')}>Settings</button>. Current: {s.prefs.diet}; allergies: {s.prefs.allergies.join(', ') || 'none declared'}; avoiding {s.prefs.avoid.length} foods. Always check ingredients yourself.</p>
        <div className="full row wrap"><button className="btn outline" onClick={() => generate(1)}>Suggest today’s meals</button><button className="btn" onClick={() => generate(7)}>Generate weekly plan</button></div>
      </div>
      <PriceEditor ids={needed} />
      {note && <p className="warn" role="alert">{note}</p>}
      {!plan && <p className="empty">No plan yet. Add what you know and generate one.</p>}
      {plan && total && <>
        <div className={`budget ${plan.budget !== null && total.known > plan.budget ? 'over' : ''}`} role="status">
          <b>{total.complete ? `Estimated ${money(total.known)}` : total.known > 0 ? `At least ${money(total.known)}` : 'Cost unavailable'}</b>
          <span>{plan.budget === null ? 'No budget entered.' : total.known > plan.budget ? `Over your budget of ${money(plan.budget)}.` : total.complete ? `Fits your budget of ${money(plan.budget)}.` : `Budget fit unknown: ${total.missing.length} ingredients need a price.`}</span>
          <small>Cost of quantities used, not whole packs. Excludes fuel, water and seasonings.</small>
        </div>
        <div className="week">
          {plan.days.map((day, d) => <section key={d} className="card day"><h3>{day.day}</h3>
            {day.meals.map((meal, m) => {
              const items = meal.items.map((i, k) => ({ ...i, uid: `${d}-${m}-${k}` }));
              const c = cost(times([meal], plan.people), cat, s.prices, plan.pantry);
              const key = `${d}-${m}`;
              return <div className="plan-meal" key={m}>
                <label className="row"><input type="checkbox" checked={plan.done.includes(key)} onChange={() => update({ done: plan.done.includes(key) ? plan.done.filter(x => x !== key) : [...plan.done, key] })} /><small>{meal.slot} · done</small></label>
                <select aria-label={`${day.day} ${meal.slot}`} value={meal.templateId} onChange={e => replace(d, m, scale(TEMPLATES.find(t => t.id === e.target.value)!, meal.slot))}>{eligible(meal.slot, cat, { days: 1, people, budget: null, snacks, slots, pantry, equipment, prefs: s.prefs, variety: 0 }).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <p className="fine">{fmtTotal(mealTotals(items, cat).energyKcal, 'kcal')} and {fmtTotal(mealTotals(items, cat).proteinGrams, 'g')} protein per person · {c.complete ? money(c.known) : 'cost unavailable'}</p>
                <details><summary>Edit portions and ingredients</summary>
                  {meal.items.map((it, k) => <div className="ing" key={k}><Swatch food={cat[it.foodId]} size={20} />
                    <select aria-label="Ingredient" value={it.foodId} onChange={e => replace(d, m, { ...meal, items: meal.items.map((x, j) => (j === k ? { ...x, foodId: e.target.value } : x)) })}>{[cat[it.foodId], ...alternatives(cat[it.foodId], foods, s.prefs)].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <input aria-label="Grams per person" type="number" min={0} value={Math.round(it.grams)} onChange={e => replace(d, m, { ...meal, items: meal.items.map((x, j) => (j === k ? { ...x, grams: Math.max(0, +e.target.value) } : x)) })} />g</div>)}
                  <p className="fine">Swaps stay in the same plate group but are not nutritionally identical. For example, beans or eggs can stand in for fish as a protein-rich food; they differ in fat, fibre and vitamins.</p>
                </details>
                <button className="link" onClick={() => { setPlate(items); go('/build'); }}>View on 3D plate</button>
              </div>;
            })}
          </section>)}
        </div>
        <div className="card">
          <div className="row between wrap"><h2>Shopping list</h2><button className="btn sm" onClick={exportList}>Export list (.txt)</button></div>
          <p className="fine">The plan saves automatically in this browser. Ticked: {plan.bought.length} of {list.filter(l => !l.have).length}. Quantities are approximate.</p>
          {SHOP_GROUPS.map(g => { const rows = list.filter(l => l.group === g); return rows.length ? <div key={g}><h4>{g}</h4>{rows.map(l => <label className="shop" key={l.foodId}><input type="checkbox" disabled={l.have} checked={l.have || plan.bought.includes(l.foodId)} onChange={() => update({ bought: plan.bought.includes(l.foodId) ? plan.bought.filter(x => x !== l.foodId) : [...plan.bought, l.foodId] })} /><span>{l.name}</span><span>≈ {fmt(Math.ceil(l.buyGrams / 10) * 10)} g</span><b>{l.have ? 'Have it' : l.cost === null ? 'No price' : money(l.cost)}</b></label>)}</div> : null; })}
          <button className="link danger" onClick={() => setState({ plan: null })}>Delete plan</button>
        </div>
      </>}
    </Page>
  );
}

function PriceEditor({ ids }: { ids: string[] }) {
  const { prices, currency } = useStore();
  const { cat } = useFoods();
  const set = (id: string, perKg: string) => setState(s => {
    const next = { ...s.prices };
    if (!(+perKg > 0)) delete next[id];
    else next[id] = { yield: next[id]?.yield, perKg: +perKg, source: 'Entered by you', date: new Date().toISOString().slice(0, 10) };
    return { prices: next };
  });
  return (
    <details className="card">
      <summary><b>My market prices</b> ({Object.keys(prices).length} entered)</summary>
      <p className="fine">Enter the price per kg of the food <b>as you buy it</b> (for oil and milk, convert from litres: 1 L oil ≈ 0.92 kg, 1 L milk ≈ 1.03 kg). “Yield” is approximate grams eaten per gram bought; adjust it if yours differs.</p>
      <div className="prices">
        {ids.filter(id => cat[id]).sort((a, b) => cat[a].buyAs.localeCompare(cat[b].buyAs)).map(id => <div key={id}>
          <span>{cat[id].buyAs}<small>{prices[id] ? `${prices[id].source}, ${prices[id].date}` : 'no price'}</small></span>
          <input type="number" min={0} placeholder={`${currency}/kg`} aria-label={`Price per kg of ${cat[id].buyAs}`} value={prices[id]?.perKg ?? ''} onChange={e => set(id, e.target.value)} />
          <input type="number" min={0.05} step={0.05} aria-label={`Yield of ${cat[id].buyAs}`} title="Yield" disabled={!prices[id]} value={prices[id]?.yield ?? cat[id].yield} onChange={e => setState(s => ({ prices: { ...s.prices, [id]: { ...s.prices[id], yield: +e.target.value || undefined } } }))} />
        </div>)}
      </div>
    </details>
  );
}
