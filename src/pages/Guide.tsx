import { useState } from 'react';
import { go, Page } from '../components/ui';
import { fmtTotal, isAllowed, mealTotals, type MealItem } from '../lib/nutrition';
import { setPlate, uid, useFoods, useStore } from '../lib/store';

interface Reply { answer: string; meals: { name: string; foodIds: string[]; why: string }[]; referral?: boolean }
const EXAMPLES = ['What can I prepare with rice, beans and tomatoes?', 'How can I add more vegetables to my meals?', 'Suggest a meal using sweet potatoes and eggs.', 'What is the difference between carbohydrates and protein?'];

export default function Guide() {
  const { foods, cat } = useFoods();
  const { prefs, plan, currency } = useStore();
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState<{ q: string; r?: Reply; error?: string }[]>([]);
  const [pendingQ, setPendingQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (q: string) => {
    const cleanQ = q.trim().slice(0, 600);
    if (!cleanQ || busy) return;
    setBusy(true); setPendingQ(cleanQ); setQuestion('');
    const history = log
      .filter(entry => entry.r?.answer && !entry.r?.referral)
      .slice(0, 4)
      .reverse()
      .map(entry => ({ q: entry.q, a: entry.r!.answer }));
    try {
      const res = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQ,
          diet: prefs.diet,
          budget: plan?.budget ? `${currency} ${plan.budget}` : '',
          foods: foods.filter(f => isAllowed(f, prefs)).map(f => ({ id: f.id, name: f.name, group: f.group })),
          allergies: prefs.allergies,
          history,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'NutriGuide is unavailable right now.');
      setLog(l => [{ q: cleanQ, r: data }, ...l]);
    } catch (e) { setLog(l => [{ q: cleanQ, error: (e as Error).message }, ...l]); }
    setPendingQ('');
    setBusy(false);
  };
  return (
    <Page eyebrow="NutriGuide AI" title="Ask about everyday food" intro="Educational ideas only, not medical or clinical advice. The AI suggests; the nutrition engine does all the numbers.">
      <p className="fine">Your question, diet type, declared allergies, plan budget and the list of allowed food names are sent to Google’s Gemini API. Do not include personal or medical details. AI can be wrong, so check ingredients for allergens.</p>
      <form className="ask" onSubmit={e => { e.preventDefault(); ask(question); }}><input value={question} maxLength={600} onChange={e => setQuestion(e.target.value)} placeholder="Ask about meals, food groups or swaps…" aria-label="Your question" /><button className="btn" disabled={busy || !question.trim()}>{busy ? 'Thinking…' : 'Ask'}</button></form>
      <div className="chips">
        {EXAMPLES.map(x => <button key={x} disabled={busy} onClick={() => ask(x)}>{x}</button>)}
        {log.length > 0 && <button type="button" disabled={busy} onClick={() => setLog([])}>Clear conversation</button>}
      </div>
      {busy && pendingQ && (
        <article className="card" aria-live="polite">
          <h3>{pendingQ}</h3>
          <p className="fine">Checking everyday meal ideas…</p>
        </article>
      )}
      {log.map((entry, i) => <article className="card" key={log.length - i}>
        <h3>{entry.q}</h3>
        {entry.error && <p className="warn" role="alert">{entry.error}</p>}
        {entry.r && <><p style={{ whiteSpace: 'pre-line' }}>{entry.r.answer}</p>
          {entry.r.meals.map((m, k) => {
            const items: MealItem[] = m.foodIds.filter(id => cat[id] && isAllowed(cat[id], prefs)).map(id => ({ uid: uid(), foodId: id, grams: cat[id].defaultServingGrams }));
            if (!items.length) return null;
            return <div className="suggest" key={k}><b>{m.name}</b><p>{m.why}</p><p className="fine">{items.map(x => cat[x.foodId].name).join(' · ')}<br />Engine estimate at default servings: {fmtTotal(mealTotals(items, cat).energyKcal, 'kcal')}, protein {fmtTotal(mealTotals(items, cat).proteinGrams, 'g')}</p><button className="btn sm" onClick={() => { setPlate(items); go('/build'); }}>Put on my plate</button></div>;
          })}</>}
      </article>)}
    </Page>
  );
}
