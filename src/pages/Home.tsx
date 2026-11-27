import { useMemo, useState } from 'react';
import { LogoMark } from '../components/Logo';
import { PlateStage } from '../components/PlateStage';
import { Bars, go, Swatch } from '../components/ui';
import { useTilt } from '../lib/motion';
import { SAMPLE, setPlate, useFoods } from '../lib/store';
import { portion } from '../lib/nutrition';

const HERO = [...SAMPLE, { uid: 'sample-tomato', foodId: 'tomato', grams: 70 }];
const TRUST_CHIPS = ['East African foods', 'Honest data labels', 'Prices you enter'];

function SproutDivider() {
  return (
    <div className="sprout-divider center" aria-hidden="true">
      <svg width="28" height="18" viewBox="0 0 24 16" fill="none">
        <path d="M12 15V7" stroke="#123B2A" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 9C12 4.5 16.5 3 19 3C19 7 16 9 12 9Z" fill="#4DBB78" />
        <path d="M12 11.5C12 7.5 8 6 5 6.5C5 10 8 11.5 12 11.5Z" fill="#123B2A" />
      </svg>
    </div>
  );
}

export default function Home() {
  const { foods, cat } = useFoods();
  const [pick, setPick] = useState('beans');
  const [flipped, setFlipped] = useState<string | null>(null);
  const tilt = useTilt(8);
  const floating = useMemo(() => ['banana', 'avocado', 'fish', 'carrot', 'egg', 'maize', 'orange'], []);
  const f = cat[pick];
  const demo = () => { setPlate(SAMPLE.map(i => ({ ...i }))); go('/build'); };

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">NutriVerse · the living plate</p>
          <h1>Discover what’s<br />on <em className="hero-your">your</em> plate.</h1>
          <p>Explore food in 3D, understand your nutrition, and create affordable balanced meals using foods you already know.</p>
          <div className="row">
            <button className="btn lime lg" onClick={() => go('/build')}>Build My Plate</button>
            <button className="btn ghost lg" onClick={() => go('/lab')}>Explore Nutrition</button>
          </div>
          <div className="trust-chips" aria-label="Core principles">
            {TRUST_CHIPS.map(label => <span key={label} className="trust-chip">{label}</span>)}
          </div>
          <button className="link hero-tour" onClick={demo}>Or start the guided tour with a sample meal →</button>
        </div>
        <div className="hero-stage">
          <PlateStage hero items={HERO} cat={cat} floating={floating} onPlateClick={demo} label="A rotating 3D plate of ugali, beans, sukuma wiki and tomato" />
          <p className="hint">Drag to turn. Select the plate to start building.</p>
        </div>
      </section>

      <div className="ticker" aria-hidden><div>{[0, 1].map(n => <span key={n}>Ugali ✺ Sukuma wiki ✺ Githeri ✺ Ndengu ✺ Mukimo ✺ Matoke ✺ Terere ✺ Maharagwe ✺ Samaki ✺ Viazi vitamu ✺&nbsp;</span>)}</div></div>

      <section className="band reveal stagger">
        <div><p className="eyebrow">Nutrition you can see</p><h2 className="reveal">Tap a food. Watch the numbers explain themselves.</h2><p>Each figure comes from a food record with a stated preparation, serving basis and source. When data is missing, we say so.</p></div>
        <div className="card stitch">
          <div className="chips">{['beans', 'sukuma', 'rice', 'fish', 'avocado'].map(id => <button key={id} className={pick === id ? 'on' : ''} onClick={() => setPick(id)}><Swatch food={cat[id]} size={22} />{cat[id].name}</button>)}</div>
          <p className="fine">Per 100 g, {f.preparationMethod.toLowerCase()}</p>
          <Bars unit="g" rows={([['Protein', 'proteinGrams', '#f16b59'], ['Carbohydrate', 'carbohydrateGrams', '#ffa45b'], ['Fat', 'fatGrams', '#e2b93b'], ['Fibre', 'fibreGrams', '#4dbb78']] as const).map(([label, k, color]) => ({ label, color, value: portion(f, 100, k) }))} />
        </div>
      </section>

      <section className="band dark reveal stagger">
        <div><p className="eyebrow">Build your plate</p><h2 className="reveal">Drag, portion, turn, compare.</h2><p>Foods settle into the Plate Compass as you add them. The coloured ring around the plate fills as your meal approaches the teaching guide.</p><button className="btn lime" onClick={demo}>Try the sample meal</button></div>
        <ol className="steps"><li><b>Add</b> a food from the pantry shelf, or drag it onto the plate.</li><li><b>Portion</b> it in grams, millilitres or clear servings.</li><li><b>See</b> what each food contributes.</li><li><b>Save</b> it and compare it with another meal.</li></ol>
      </section>

      <section className="band reveal stagger">
        <div><p className="eyebrow">Within your budget</p><h2 className="reveal">Eat well. Spend wisely.</h2><p>Enter the prices you actually pay at your market. NutriVerse never makes up a price. It plans a week, suggests swaps and writes your shopping list.</p><button className="btn" onClick={() => go('/planner')}>Plan on a budget</button></div>
        <div className="receipt stitch"><b>How a plan is priced</b><p><span>Your price per kg</span><span>you enter it</span></p><p><span>Cooked → bought weight</span><span>shown, editable</span></p><p><span>Missing price</span><span>marked unknown</span></p><p><span>Pantry foods</span><span>not charged</span></p></div>
      </section>

      <section className="band reveal wide stagger">
        <div><p className="eyebrow">Explore your food</p><h2 className="reveal">Foods from home, front and centre.</h2></div>
        <div className="tiles">
          {['ugali', 'githeri', 'sukuma', 'greengrams', 'sweetpotato', 'amaranth', 'matoke', 'fish']
            .map(id => foods.find(x => x.id === id)!)
            .map(x => {
              const isFlipped = flipped === x.id;
              return (
                <button
                  key={x.id}
                  className={`tilt-card flip-tile${isFlipped ? ' is-flipped' : ''}`}
                  {...tilt}
                  onClick={() => {
                    if (isFlipped) go(`/food/${x.id}`);
                    else if (matchMedia('(hover: none)').matches) setFlipped(x.id);
                    else go(`/food/${x.id}`);
                  }}
                >
                  <span className="flip-inner">
                    <span className="flip-face flip-front">
                      <Swatch food={x} size={88} />
                      <b>{x.name}</b>
                      <span className="tile-tag">{x.regionalNames[0] ?? x.category}</span>
                    </span>
                    <span className="flip-face flip-back">
                      <span className="tile-tag">{x.regionalNames[0] ?? x.category}</span>
                      <b>{x.name}</b>
                      <small>{x.servingDescription}</small>
                      <span className="flip-go">Open profile →</span>
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      </section>

      <SproutDivider />

      <section className="band reveal stagger">
        <div><p className="eyebrow">Learn by doing</p><h2 className="reveal">Short lessons, plate challenges, instant feedback.</h2></div>
        <div className="row wrap"><button className="btn lg" onClick={() => go('/learn')}>Open Nutrition Academy</button></div>
      </section>

      <section className="finale reveal">
        <div className="finale-bg" aria-hidden="true"><LogoMark size={260} /></div>
        <div className="finale-inner">
          <h2>Your next meal can be a smarter one.</h2>
          <button className="btn lg" onClick={() => go('/build')}>Start Exploring</button>
        </div>
      </section>
    </main>
  );
}
