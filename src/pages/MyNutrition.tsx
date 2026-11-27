import { go, NutritionPanel, Page, Swatch } from '../components/ui';
import { LESSONS } from '../data/learn';
import { cost, planCost, shoppingList } from '../lib/planner';
import { fmtTotal, mealTotals } from '../lib/nutrition';
import { setPlate, setState, useFoods, useStore } from '../lib/store';
import { achievements } from './Learn';

export default function MyNutrition() {
  const s = useStore();
  const { cat } = useFoods();
  const day = (d: string) => new Date(d).toDateString();
  const today = s.meals.filter(m => day(m.date) === new Date().toDateString());
  const week = s.meals.filter(m => Date.now() - +new Date(m.date) < 7 * 864e5);
  const groups = new Set(week.flatMap(m => m.items.map(i => cat[i.foodId]?.category)).filter(Boolean));
  const priced = s.meals.map(m => cost(m.items, cat, s.prices)).filter(c => c.complete);
  const planTotal = s.plan ? planCost(s.plan.days, cat, s.prices, s.plan.people, s.plan.pantry) : null;
  const shopping = s.plan ? shoppingList(s.plan.days, cat, s.prices, s.plan.people, s.plan.pantry).filter(l => !l.have) : [];
  const planMeals = s.plan?.days.reduce((a, d) => a + d.meals.length, 0) ?? 0;
  const insights = [
    groups.size && `You have explored ${groups.size} food categories in meals saved this week.`,
    priced.length && `${priced.length} saved meal(s) can be fully costed with your prices.`,
    s.lessons.length && `You have completed ${s.lessons.length} nutrition lesson(s).`,
    s.explored.length && `You have opened ${s.explored.length} food profile(s).`,
  ].filter(Boolean);

  return (
    <Page eyebrow="My Nutrition" title="Your food notebook" intro="A learning record of what you save, not a complete diet record or a medical assessment.">
      <div className="stats">
        <div><b>{week.length}</b><span>meals recorded, 7 days</span></div>
        <div><b>{groups.size}</b><span>food categories explored</span></div>
        <div><b>{s.plan ? `${s.plan.done.length}/${planMeals}` : '–'}</b><span>planned meals completed</span></div>
        <div><b>{s.lessons.length}/{LESSONS.length}</b><span>lessons complete</span></div>
      </div>
      {insights.length > 0 && <div className="card"><ul>{insights.map(t => <li key={t as string}>{t}</li>)}</ul></div>}
      <div className="grid2">
        <div className="card"><h3>Today’s saved meals</h3>{today.length ? <><p>{today.map(m => m.name).join(', ')}</p><h4>Estimate for these saved meals only</h4><NutritionPanel items={today.flatMap(m => m.items.map(i => ({ ...i, uid: m.id + i.uid })))} cat={cat} /></> : <p className="empty">Nothing saved today.</p>}</div>
        <div className="card"><h3>Budget overview</h3>
          <table><tbody>
            <tr><th>Planned budget</th><td>{s.plan?.budget != null ? `${s.currency} ${s.plan.budget.toFixed(0)}` : 'Not entered'}</td></tr>
            <tr><th>Estimated plan spend</th><td>{planTotal?.complete ? `${s.currency} ${planTotal.known.toFixed(0)}` : 'Unavailable (prices missing or no plan)'}</td></tr>
            <tr><th>Fully priced saved meals</th><td>{priced.length ? `${s.currency} ${priced.reduce((a, c) => a + c.known, 0).toFixed(0)} across ${priced.length}` : 'None'}</td></tr>
            <tr><th>Shopping progress</th><td>{s.plan ? `${s.plan.bought.length} of ${shopping.length} items` : 'No plan'}</td></tr>
          </tbody></table>
          <button className="btn sm outline" onClick={() => go('/planner')}>Open planner</button>
          <h3>Achievements</h3><div className="chips achievements">{achievements(s.lessons, s.quiz).map(([n, ok]) => <span key={n} className={ok ? 'on' : ''}>{ok ? '★' : '☆'} {n}</span>)}</div>
        </div>
      </div>
      <div className="card"><h3>Meal history</h3>
        {!s.meals.length && <p className="empty">Saved meals appear here. <button className="link" onClick={() => go('/build')}>Build your first plate</button></p>}
        {s.meals.map(m => <div className="history" key={m.id}><div className="row">{m.items.slice(0, 5).map(i => cat[i.foodId] && <Swatch key={i.uid} food={cat[i.foodId]} size={28} />)}</div><span><b>{m.name}</b><small>{new Date(m.date).toLocaleString()} · {fmtTotal(mealTotals(m.items, cat).energyKcal, 'kcal')}</small></span><button className="btn sm outline" onClick={() => { setPlate(m.items.map(i => ({ ...i }))); go('/build'); }}>Open in 3D</button><button className="link danger" onClick={() => setState({ meals: s.meals.filter(x => x.id !== m.id) })}>Delete</button></div>)}
      </div>
    </Page>
  );
}
