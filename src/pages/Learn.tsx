import { useState } from 'react';
import { LESSONS, type Lesson } from '../data/learn';
import { PlateStage } from '../components/PlateStage';
import { go, Page, PlateGuide, Swatch } from '../components/ui';
import { plateShares, type MealItem } from '../lib/nutrition';
import { setState, useFoods, useStore } from '../lib/store';

export const achievements = (lessons: string[], quiz: Record<string, number>) => [
  ['First bite', lessons.length >= 1], ['Plate scholar', lessons.length >= 5], ['Full course', lessons.length >= LESSONS.length],
  ['Sharp palate', Object.values(quiz).filter(v => v === 100).length >= 3], ['Plate builder', (quiz['challenge'] ?? 0) === 100],
] as [string, boolean][];

export default function Learn({ id }: { id?: string }) {
  const lesson = LESSONS.find(l => l.id === id);
  const { lessons, quiz } = useStore();
  const next = LESSONS.find(l => !lessons.includes(l.id));
  if (lesson) return <LessonView lesson={lesson} key={lesson.id} />;
  return (
    <Page eyebrow="Nutrition Academy" title="Learn it by touching it" intro={`${lessons.length} of ${LESSONS.length} lessons complete.`} actions={next && <button className="btn" onClick={() => go(`/learn/${next.id}`)}>Next: {next.title}</button>}>
      <div className="lessons">{LESSONS.map((l, i) => <button key={l.id} onClick={() => go(`/learn/${l.id}`)}><small>Lesson {i + 1}</small><b>{l.title}</b><span>{lessons.includes(l.id) ? `✓ Completed · best ${quiz[l.id] ?? 0}%` : 'Not started'}</span></button>)}</div>
      <div className="chips achievements">{achievements(lessons, quiz).map(([n, ok]) => <span key={n} className={ok ? 'on' : ''}>{ok ? '★' : '☆'} {n}</span>)}</div>
      <Challenge />
      <Sorter />
    </Page>
  );
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const { cat } = useFoods();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [focus, setFocus] = useState(lesson.foods[0]);
  const done = Object.keys(answers).length === lesson.questions.length;
  const score = Math.round(lesson.questions.filter((q, i) => answers[i] === q.answer).length / lesson.questions.length * 100);
  const answer = (i: number, k: number) => {
    if (answers[i] !== undefined) return;
    const a = { ...answers, [i]: k }; setAnswers(a);
    if (Object.keys(a).length === lesson.questions.length) {
      const sc = Math.round(lesson.questions.filter((q, j) => a[j] === q.answer).length / lesson.questions.length * 100);
      setState(s => ({ lessons: s.lessons.includes(lesson.id) ? s.lessons : [...s.lessons, lesson.id], quiz: { ...s.quiz, [lesson.id]: Math.max(sc, s.quiz[lesson.id] ?? 0) } }));
    }
  };
  return (
    <Page eyebrow="Lesson" title={lesson.title} actions={<button className="btn outline" onClick={() => go('/learn')}>All lessons</button>}>
      <div className="split">
        <div className="card"><ul className="points">{lesson.points.map(p => <li key={p}>{p}</li>)}</ul></div>
        <div className="card"><div className="detail-stage small"><PlateStage key={focus} items={[{ uid: focus, foodId: focus, grams: cat[focus].defaultServingGrams, pos: { x: 0, z: 0 } }]} cat={cat} /></div>
          <div className="chips">{lesson.foods.map(f => <button key={f} className={focus === f ? 'on' : ''} onClick={() => setFocus(f)}><Swatch food={cat[f]} size={20} />{cat[f].name}</button>)}</div><p>{cat[focus].description}</p></div>
      </div>
      {lesson.questions.map((q, i) => <fieldset className="card quiz" key={q.q}><legend>{q.q}</legend>
        {q.options.map((o, k) => <button key={o} disabled={answers[i] !== undefined} className={answers[i] === undefined ? '' : k === q.answer ? 'right' : answers[i] === k ? 'wrong' : ''} onClick={() => answer(i, k)}>{o}</button>)}
        {answers[i] !== undefined && <p role="status"><b>{answers[i] === q.answer ? 'Correct.' : 'Not quite.'}</b> {q.why}</p>}
      </fieldset>)}
      {done && <div className="card"><h2>You scored {score}%</h2><p>Lesson complete.</p><div className="row"><button className="btn" onClick={() => go('/learn')}>Continue</button><button className="btn outline" onClick={() => setAnswers({})}>Try again</button></div></div>}
    </Page>
  );
}

const CHALLENGE = ['rice', 'ugali', 'beans', 'egg', 'cabbage', 'carrot', 'mango', 'oil'];
function Challenge() {
  const { cat } = useFoods();
  const [items, setItems] = useState<MealItem[]>([]);
  const { shares, counted } = plateShares(items, cat);
  const won = counted > 0 && Math.abs(shares.vegfruit - .5) <= .08 && Math.abs(shares.protein - .25) <= .08 && Math.abs(shares.staple - .25) <= .08;
  return (
    <div className="card"><h2>Plate-building challenge</h2><p>Add 100 g scoops until each guide share is within 8 points of ½ vegetables and fruit, ¼ protein, ¼ staple.</p>
      <div className="chips">{CHALLENGE.map(id => <button key={id} disabled={items.length >= 12} onClick={() => setItems([...items, { uid: `c${items.length}-${id}`, foodId: id, grams: 100 }])}>+ {cat[id].name}</button>)}<button onClick={() => setItems([])}>Start again</button></div>
      <PlateGuide items={items} cat={cat} />
      {won && <p className="success" role="status">You matched the guide. <button className="btn sm" onClick={() => setState(s => ({ quiz: { ...s.quiz, challenge: 100 } }))}>Claim achievement</button></p>}
    </div>
  );
}

const SORT = ['greengrams', 'pumpkin', 'millet', 'fish', 'pawpaw', 'sweetpotato', 'amaranth'];
function Sorter() {
  const { cat } = useFoods();
  const [i, setI] = useState(0), [msg, setMsg] = useState(''), [right, setRight] = useState(0);
  const f = cat[SORT[i]];
  return (
    <div className="card"><h2>Name that food group</h2>
      {f ? <><div className="row"><Swatch food={f} size={60} /><b>{f.name}</b><small>{i + 1} of {SORT.length}</small></div>
        <div className="chips">{[['vegfruit', 'Vegetable or fruit'], ['protein', 'Protein-rich'], ['staple', 'Staple']].map(([k, l]) => <button key={k} onClick={() => { const ok = f.group === k; setRight(right + +ok); setMsg(ok ? `Yes: ${f.name} fits “${l}”.` : `${f.name} sits in the ${f.group === 'vegfruit' ? 'vegetable and fruit' : f.group} part of our guide.`); setI(i + 1); }}>{l}</button>)}</div></>
        : <><p>You got {right} of {SORT.length}.</p><button className="btn sm" onClick={() => { setI(0); setRight(0); setMsg(''); }}>Play again</button></>}
      <p role="status">{msg}</p>
    </div>
  );
}
