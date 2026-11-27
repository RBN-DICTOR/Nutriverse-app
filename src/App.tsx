import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from './components/Logo';
import { setMotionSetting, useMotionReduced, useReveal } from './lib/motion';
import Home from './pages/Home';
import Builder from './pages/Builder';
import Explorer from './pages/Explorer';
import Lab from './pages/Lab';
import Planner from './pages/Planner';
import Scanner from './pages/Scanner';
import Compare from './pages/Compare';
import Guide from './pages/Guide';
import Learn from './pages/Learn';
import MyNutrition from './pages/MyNutrition';
import Settings from './pages/Settings';

const NAV = [['/', 'Home'], ['/build', 'Meal Builder'], ['/explore', 'Food Explorer'], ['/lab', 'Nutrition Lab'], ['/planner', 'Meal Planner'], ['/scan', 'Scanner'], ['/guide', 'NutriGuide'], ['/learn', 'Learn'], ['/me', 'My Nutrition'], ['/settings', 'Profile']];
const MOBILE = [['/', 'Home', '⌂'], ['/build', 'Build', '◎'], ['/explore', 'Foods', '❧'], ['/planner', 'Plan', '▦']];

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="page"><h1>Something went wrong</h1><p>Reload the page. Your saved data is kept.</p><button className="btn" onClick={() => location.reload()}>Reload</button></main> : this.props.children; }
}

function useRoute() {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(read);
  useEffect(() => { const on = () => { setPath(read()); window.scrollTo(0, 0); }; addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return path;
}

export default function App() {
  const path = useRoute();
  const [, section = '', id] = path.split('/');
  const [more, setMore] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [pill, setPill] = useState<{ left: number; width: number; show: boolean }>({ left: 0, width: 0, show: false });
  const linksRef = useRef<HTMLDivElement>(null);
  const magBtnRef = useRef<HTMLElement | null>(null);
  const reduced = useMotionReduced();

  useReveal(path);

  useEffect(() => setMore(false), [path]);

  // Thin lime scroll-progress bar under the top bar.
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [path]);

  // Sliding active indicator in top nav.
  useLayoutEffect(() => {
    const box = linksRef.current;
    if (!box) return;
    const measure = () => {
      const act = box.querySelector('a.on') as HTMLElement | null;
      if (!act || !act.offsetWidth) {
        setPill(p => (p.show ? { ...p, show: false } : p));
        return;
      }
      setPill({ left: act.offsetLeft, width: act.offsetWidth, show: true });
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [section]);

  // Global magnetic hover (max 6 px) and click ripple on primary .btn controls.
  useEffect(() => {
    const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const clearMag = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
    const onMove = (e: PointerEvent) => {
      if (reduced || isCoarse || e.pointerType === 'touch') {
        clearMag(magBtnRef.current);
        magBtnRef.current = null;
        return;
      }
      const btn = (e.target as HTMLElement | null)?.closest('.btn:not(:disabled)') as HTMLElement | null;
      if (magBtnRef.current && magBtnRef.current !== btn) clearMag(magBtnRef.current);
      magBtnRef.current = btn;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dx = Math.max(-6, Math.min(6, ((e.clientX - r.left) / r.width - 0.5) * 12));
      const dy = Math.max(-6, Math.min(6, ((e.clientY - r.top) / r.height - 0.5) * 12));
      btn.style.setProperty('--mx', `${dx.toFixed(2)}px`);
      btn.style.setProperty('--my', `${dy.toFixed(2)}px`);
    };
    const onLeave = () => {
      clearMag(magBtnRef.current);
      magBtnRef.current = null;
    };
    const onClick = (e: MouseEvent) => {
      if (reduced) return;
      const btn = (e.target as HTMLElement | null)?.closest('.btn:not(:disabled)') as HTMLElement | null;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const rx = e.clientX ? e.clientX - r.left : r.width / 2;
      const ry = e.clientY ? e.clientY - r.top : r.height / 2;
      btn.style.setProperty('--rip-x', `${rx.toFixed(1)}px`);
      btn.style.setProperty('--rip-y', `${ry.toFixed(1)}px`);
      btn.classList.remove('btn-rippling');
      void btn.offsetWidth;
      btn.classList.add('btn-rippling');
      window.setTimeout(() => btn.classList.remove('btn-rippling'), 520);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('click', onClick);
    return () => {
      clearMag(magBtnRef.current);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('click', onClick);
    };
  }, [reduced]);

  const pages: Record<string, ReactNode> = {
    '': <Home />, build: <Builder />, explore: <Explorer />, food: <Explorer id={id} />, lab: <Lab />, planner: <Planner />,
    scan: <Scanner />, compare: <Compare />, guide: <Guide />, learn: <Learn id={id} />, me: <MyNutrition />, settings: <Settings />,
  };
  const active = (href: string) => href === '/' + section || (section === 'food' && href === '/explore');

  return (
    <>
      <nav className="top" aria-label="Main">
        <a href="#/" className="logo" aria-label="NutriVerse Home"><Logo /></a>
        <div className="links" ref={linksRef}>
          {pill.show && <span className="links-pill" aria-hidden="true" style={{ transform: `translateX(${pill.left}px)`, width: `${pill.width}px` }} />}
          {NAV.slice(1).map(([h, l]) => <a key={h} href={'#' + h} className={active(h) ? 'on' : ''}>{l}</a>)}
        </div>
        <a className="btn lime sm" href="#/build">Build My Plate</a>
        <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${scrollPct})` }} />
      </nav>
      <div className="page-enter" key={section}>
        <Boundary key={path}>{pages[section] ?? <main className="page"><h1>Page not found</h1><a className="btn" href="#/">Go home</a></main>}</Boundary>
      </div>
      {section !== 'build' && (
        <footer>
          <div className="footer-inner">
            <a href="#/" className="footer-brand" aria-label="NutriVerse Home"><Logo light /></a>
            <p>Build better plates. Understand better nutrition. For education only, not medical advice. For pregnancy, medical conditions, eating disorders or special diets, speak to a qualified health professional.</p>
            <div className="footer-row">
              <div className="footer-links">
                <a href="#/compare">Compare meals</a>
                <a href="#/explore">Food explorer</a>
                <a href="#/settings">Profile &amp; data</a>
                <a href="/NutriVerse-Documentation.pdf" download="NutriVerse-Documentation.pdf">Documentation (PDF)</a>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reduced}
                className={`motion-toggle${reduced ? ' on' : ''}`}
                onClick={() => setMotionSetting(reduced ? 'full' : 'reduce')}
              >
                <span>Reduce motion</span>
                <i aria-hidden="true" />
              </button>
            </div>
          </div>
        </footer>
      )}
      {more && <div className="sheet" role="dialog" aria-label="More pages">{NAV.map(([h, l]) => <a key={h} href={'#' + h} className={active(h) ? 'on' : ''}>{l}</a>)}<a href="#/compare" className={active('/compare') ? 'on' : ''}>Compare meals</a></div>}
      <nav className="bottom" aria-label="Mobile">{MOBILE.map(([h, l, i]) => <a key={h} href={'#' + h} className={active(h) ? 'on' : ''}><i>{i}</i>{l}</a>)}<button aria-expanded={more} className={more ? 'on' : ''} onClick={() => setMore(!more)}><i>≡</i>More</button></nav>
    </>
  );
}
