import { useEffect, useState } from 'react';
import { go, NutritionPanel, Page, Swatch } from '../components/ui';
import { isAllowed, type MealItem } from '../lib/nutrition';
import { saveMeal, setPlate, uid, useFoods, useStore } from '../lib/store';

interface Row { key: string; label: string; foodId: string; confidence: 'low' | 'medium' | 'high' | 'manual'; note: string; confirmed: boolean; grams: string }

/** Resize in the browser. Re-encoding also strips photo metadata such as GPS. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}

export default function Scanner() {
  const { foods, cat } = useFoods();
  const { prefs } = useStore();
  const [consent, setConsent] = useState(false);
  const [image, setImage] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => () => setImage(''), []);

  const choose = async (file?: File) => {
    if (!file) return;
    setError(''); setRows([]); setSaved(false);
    if (!file.type.startsWith('image/') || file.size > 12e6) return setError('Choose an image under 12 MB.');
    try { setImage(await shrink(file)); } catch { setError('This image could not be read. Try a JPEG or PNG.'); }
  };
  const analyse = async () => {
    setBusy(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, foods: foods.map(f => ({ id: f.id, name: f.name })) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Recognition is unavailable.');
      const next: Row[] = (data.items as { foodId: string; label: string; confidence: Row['confidence']; note: string }[]).map(i => ({ key: uid(), label: i.label, foodId: cat[i.foodId] && i.confidence !== 'low' ? i.foodId : '', confidence: i.confidence, note: i.note, confirmed: false, grams: '' }));
      setRows(next);
      if (!next.length) setError('No food was recognised. Add the foods yourself below.');
    } catch (e) { setError(`${(e as Error).message} You can still add the foods yourself below.`); }
    setBusy(false);
  };
  const edit = (key: string, p: Partial<Row>) => { setSaved(false); setRows(r => r.map(x => (x.key === key ? { ...x, ...p } : x))); };
  const items: MealItem[] = rows.filter(r => r.confirmed && cat[r.foodId] && +r.grams > 0).map(r => ({ uid: r.key, foodId: r.foodId, grams: Math.min(2000, +r.grams) }));

  return (
    <Page eyebrow="Scan My Plate" title="A photo suggests. You decide." intro="Recognition is a guess about which foods are visible. It cannot measure weight, calories, hidden ingredients or cooking oil.">
      <div className="split">
        <div className="card">
          <p className="fine"><b>Your photo:</b> it is resized on your device (which removes location metadata). When you press Analyse, it goes through this app’s server to Google’s Gemini API. NutriVerse does not save it. Google’s API terms apply to its processing, and free-tier content may be used to improve Google products, so avoid faces or personal details.</p>
          <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I understand and want to use a photo.</label>
          <div className="row wrap">
            <label className={`btn ${consent ? '' : 'off'}`}>Take a photo<input hidden disabled={!consent} type="file" accept="image/*" capture="environment" onChange={e => choose(e.target.files?.[0])} /></label>
            <label className={`btn outline ${consent ? '' : 'off'}`}>Upload an image<input hidden disabled={!consent} type="file" accept="image/*" onChange={e => choose(e.target.files?.[0])} /></label>
          </div>
          {image ? <><img className="preview" src={image} alt="Your meal photo" /><div className="row"><button className="btn lime" disabled={busy || !consent} onClick={analyse}>{busy ? 'Looking…' : 'Analyse photo'}</button><button className="link danger" onClick={() => { setImage(''); setRows([]); }}>Delete photo</button></div></> : <div className="drop">No photo selected. You can also skip the photo and add foods yourself.</div>}
          {error && <p className="warn" role="alert">{error}</p>}
        </div>
        <div className="card">
          <h3>Confirm foods and portions</h3>
          {!rows.length && <p className="empty">Suggestions will appear here.</p>}
          {rows.map(r => <div className="scan-row" key={r.key}>
            <div className="row between"><span><b>{r.label}</b> <span className={`badge c-${r.confidence}`}>{r.confidence === 'manual' ? 'added by you' : `${r.confidence} confidence`}</span></span><button className="x" aria-label="Delete suggestion" onClick={() => setRows(rows.filter(x => x.key !== r.key))}>✕</button></div>
            {r.note && <p className="fine">{r.note}</p>}
            {r.confidence === 'low' && <p className="fine">Low confidence: please identify this food yourself.</p>}
            <div className="row">
              {cat[r.foodId] && <Swatch food={cat[r.foodId]} size={30} />}
              <select aria-label="Food" value={r.foodId} onChange={e => edit(r.key, { foodId: e.target.value, confirmed: false })}><option value="">Choose the food…</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name} ({f.rawOrCooked})</option>)}</select>
              <input type="number" min={1} placeholder="grams" aria-label="Portion in grams" value={r.grams} onChange={e => edit(r.key, { grams: e.target.value })} />
            </div>
            {cat[r.foodId] && <div className="chips"><button onClick={() => edit(r.key, { grams: String(cat[r.foodId].defaultServingGrams) })}>Use {cat[r.foodId].servingDescription}</button></div>}
            {cat[r.foodId] && !isAllowed(cat[r.foodId], prefs) && <p className="warn">Warning: this conflicts with your diet or allergy settings. A photo can never confirm that a meal is allergen-free.</p>}
            <label className="check"><input type="checkbox" disabled={!cat[r.foodId]} checked={r.confirmed} onChange={e => edit(r.key, { confirmed: e.target.checked })} />This is correct</label>
          </div>)}
          <button className="btn sm outline" onClick={() => setRows([...rows, { key: uid(), label: 'My food', foodId: '', confidence: 'manual', note: '', confirmed: false, grams: '' }])}>+ Add a food</button>
        </div>
      </div>
      {items.length > 0 && <div className="card"><h2>Estimated nutrition for confirmed foods</h2><p className="fine">{items.length} of {rows.length} rows are confirmed with portions. Oil and hidden ingredients count only if you add them.</p><NutritionPanel items={items} cat={cat} />
        <div className="row wrap"><button className="btn" disabled={saved} onClick={() => { saveMeal('Scanned meal', items); setSaved(true); }}>{saved ? 'Saved ✓' : 'Save meal'}</button><button className="btn outline" onClick={() => { setPlate(items); go('/build'); }}>Open in 3D Meal Builder</button></div></div>}
    </Page>
  );
}
