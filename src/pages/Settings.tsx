import { useState } from 'react';
import { Page } from '../components/ui';
import { BASE_FOODS, type Allergen, type Diet } from '../data/foods';
import { clearAll, setState, useFoods, useStore } from '../lib/store';

const ALLERGENS: Allergen[] = ['peanut', 'tree nut', 'fish', 'egg', 'milk', 'gluten'];

export default function Settings() {
  const s = useStore();
  const { foods } = useFoods();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  // Verifies in small batches; stops cleanly if USDA rate-limits.
  const verify = async () => {
    setBusy(true);
    const todo = BASE_FOODS.filter(f => f.fdcQuery && !s.verified[f.id]);
    let found = 0; const unmatched: string[] = [];
    try {
      for (let i = 0; i < todo.length; i += 5) {
        setStatus(`Checking ${i + 1}–${Math.min(i + 5, todo.length)} of ${todo.length}…`);
        const res = await fetch('/api/fdc/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foods: todo.slice(i, i + 5).map(f => ({ id: f.id, query: f.fdcQuery })) }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Verification failed.');
        found += Object.keys(data.records).length; unmatched.push(...data.unmatched);
        setState(st => ({ verified: { ...st.verified, ...data.records } }));
      }
      setStatus(`Done. ${found} records replaced with USDA values.${unmatched.length ? ` No exact match for: ${unmatched.join(', ')}. These stay marked provisional.` : ''}`);
    } catch (e) { setStatus(`${(e as Error).message} ${found} records verified before stopping.`); }
    setBusy(false);
  };

  return (
    <Page eyebrow="Profile and Settings" title="Make it yours" intro="No account needed. Your data is saved in the built-in app database with a local browser cache.">
      <div className="grid2">
        <div className="card"><h3>Food preferences</h3>
          <label className="field">Diet<select value={s.prefs.diet} onChange={e => setState({ prefs: { ...s.prefs, diet: e.target.value as Diet } })}><option value="any">No restriction</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option></select></label>
          <fieldset><legend>Allergies and intolerances</legend>{ALLERGENS.map(a => <label key={a}><input type="checkbox" checked={s.prefs.allergies.includes(a)} onChange={() => setState({ prefs: { ...s.prefs, allergies: toggle(s.prefs.allergies, a) } })} />{a}</label>)}</fieldset>
          <p className="fine">Filtering covers the listed ingredients only. It cannot detect cross-contamination or packaged-food additives. Always check labels and ask the cook. For other allergies, use the avoid list.</p>
          <details><summary>Foods I cannot or will not eat ({s.prefs.avoid.length})</summary><div className="chips">{foods.map(f => <button key={f.id} className={s.prefs.avoid.includes(f.id) ? 'on' : ''} onClick={() => setState({ prefs: { ...s.prefs, avoid: toggle(s.prefs.avoid, f.id) } })}>{f.name}</button>)}</div></details>
        </div>
        <div className="card"><h3>Nutrition data</h3>
          <p>{Object.keys(s.verified).length} of {BASE_FOODS.length} base records verified against USDA FoodData Central.</p>
          <p className="fine">Bundled values are provisional until verified. Verification accepts only an exact description match and records the FDC ID. Set FDC_API_KEY (free from api.data.gov) in your server secrets; the shared demo key has very low limits. For local accuracy, review against the Kenya Food Composition Tables (2018).</p>
          <div className="row wrap"><button className="btn" disabled={busy} onClick={verify}>{busy ? 'Verifying…' : 'Verify against USDA'}</button>{Object.keys(s.verified).length > 0 && <button className="btn outline" onClick={() => setState({ verified: {} })}>Revert to bundled</button>}</div>
          <p role="status">{status}</p>
        </div>
        <div className="card"><h3>Privacy and your data</h3>
          <p className="fine">Meals, plans, prices and preferences are saved in the server’s built-in SQLite database and cached in this browser. Scan photos are never saved. AI features send only what is described on their pages. Consider Kenya’s Data Protection Act, 2019, before adding multi-user accounts.</p>
          <div className="row wrap">
            <a className="btn outline" href="/NutriVerse-Documentation.pdf" download="NutriVerse-Documentation.pdf">Download app docs (PDF)</a>
            <button className="btn outline" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...s, history: undefined }, null, 2)], { type: 'application/json' })); a.download = 'nutriverse-data.json'; a.click(); }}>Export my data</button>
            <button className="btn danger" onClick={() => { if (confirm('Delete all saved NutriVerse data from the database and this browser? This cannot be undone.')) clearAll(); }}>Delete all my data</button>
          </div>
        </div>
      </div>
    </Page>
  );
}
