import { useApp } from "./state";
import { langDir, pick } from "./i18n";
import { T } from "./strings";
import type { Bilingual } from "../content/types";

/**
 * First screen of a new visitor. It is drawn in the learner's interface language (Sorani on a first visit) and
 * choosing a country never changes that language. Kept free of the app shell, icons and content so that the
 * first paint needs as little code as possible.
 */
function useText() {
  const { settings } = useApp();
  return (t: Bilingual) => { const p = pick(t, settings.lang); return <span lang={p.lang} dir={langDir(p.lang)}>{p.text}</span>; };
}

export function CountrySelection() {
  const { setSettings } = useApp();
  const tx = useText();
  return <main className="country-entry" id="main">
    <section className="country-panel" aria-labelledby="country-title">
      <img src="/brand/regadrive-logo.webp" width={84} height={84} alt="RegaDRIVE" fetchPriority="high" />
      <h1 id="country-title">{tx(T.chooseCountry)}</h1>
      <div className="country-options">
        <button type="button" className="country-card" onClick={() => setSettings({ country: "IT" })} data-testid="country-it">
          <span className="country-flag" aria-hidden="true">🇮🇹</span><strong>{tx(T.italy)}</strong><span lang="it">Italia</span><span className="country-cta">{tx(T.choose)}</span>
        </button>
        <button type="button" className="country-card" onClick={() => setSettings({ country: "DE" })} data-testid="country-de">
          <span className="country-flag" aria-hidden="true">🇩🇪</span><strong>{tx(T.germany)}</strong><span lang="de">Deutschland</span><span className="country-cta">{tx(T.choose)}</span>
        </button>
      </div>
      <p>{tx(T.countryLater)}</p>
    </section>
  </main>;
}

export function ItalyPending() {
  const { setSettings } = useApp();
  const tx = useText();
  return <main className="country-entry" id="main"><section className="country-panel">
    <span className="country-flag" aria-hidden="true">🇮🇹</span>
    <h1>{tx(T.italy)} — <span lang="it">Patente B</span></h1>
    <p>{tx(T.italyPending)}</p>
    <button type="button" className="country-switch" onClick={() => setSettings({ country: null })} data-testid="country-change">{tx(T.changeCountry)}</button>
  </section></main>;
}
