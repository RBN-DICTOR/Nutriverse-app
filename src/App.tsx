import { Component, useEffect, useState, type ReactNode } from 'react';
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
  useEffect(() => setMore(false), [path]);
  // Scroll reveals.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => { el.classList.add('pre'); io.observe(el); });
    return () => io.disconnect();
  }, [path]);

  const pages: Record<string, ReactNode> = {
    '': <Home />, build: <Builder />, explore: <Explorer />, food: <Explorer id={id} />, lab: <Lab />, planner: <Planner />,
    scan: <Scanner />, compare: <Compare />, guide: <Guide />, learn: <Learn id={id} />, me: <MyNutrition />, settings: <Settings />,
  };
  const active = (href: string) => href === '/' + section || (section === 'food' && href === '/explore');

  return (
    <>
      <nav className="top" aria-label="Main">
        <a href="#/" className="logo"><span aria-hidden />NutriVerse</a>
        <div className="links">{NAV.slice(1).map(([h, l]) => <a key={h} href={'#' + h} className={active(h) ? 'on' : ''}>{l}</a>)}</div>
        <a className="btn lime sm" href="#/build">Build My Plate</a>
      </nav>
      <Boundary key={path}>{pages[section] ?? <main className="page"><h1>Page not found</h1><a className="btn" href="#/">Go home</a></main>}</Boundary>
      {section !== 'build' && <footer><b>NutriVerse</b><p>Build better plates. Understand better nutrition. For education only, not medical advice. For pregnancy, medical conditions, eating disorders or special diets, speak to a qualified health professional.</p><a href="#/compare">Compare meals</a></footer>}
      {more && <div className="sheet">{NAV.map(([h, l]) => <a key={h} href={'#' + h}>{l}</a>)}<a href="#/compare">Compare meals</a></div>}
      <nav className="bottom" aria-label="Mobile">{MOBILE.map(([h, l, i]) => <a key={h} href={'#' + h} className={active(h) ? 'on' : ''}><i>{i}</i>{l}</a>)}<button aria-expanded={more} onClick={() => setMore(!more)}><i>≡</i>More</button></nav>
    </>
  );
}
