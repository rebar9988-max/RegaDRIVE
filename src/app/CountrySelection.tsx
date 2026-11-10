import { useApp } from "./state";

export function CountrySelection() {
  const { setSettings } = useApp();
  return <main className="country-entry" id="main">
    <section className="country-panel" aria-labelledby="country-title">
      <img src="/brand/regadrive-logo.svg" width={84} height={84} alt="RegaDRIVE" />
      <h1 id="country-title">وڵاتی تاقیکردنەوەکەت هەڵبژێرە</h1>
      <p lang="en">Choose your driving licence country</p>
      <div className="country-options">
        <button type="button" className="country-card" onClick={() => setSettings({ country: "IT" })}>
          <span className="country-flag" aria-hidden="true">🇮🇹</span><strong>ئیتاڵیا</strong><span lang="it">Italia</span><span className="country-cta">هەڵبژاردن</span>
        </button>
        <button type="button" className="country-card" onClick={() => setSettings({ country: "DE" })}>
          <span className="country-flag" aria-hidden="true">🇩🇪</span><strong>ئەڵمانیا</strong><span lang="de">Deutschland</span><span className="country-cta">هەڵبژاردن</span>
        </button>
      </div>
      <p>دەتوانیت دواتر وڵاتەکەت بگۆڕیت.</p>
    </section>
  </main>;
}

export function ItalyPending() {
  const { setSettings } = useApp();
  return <main className="country-entry" id="main"><section className="country-panel">
    <span className="country-flag" aria-hidden="true">🇮🇹</span>
    <h1>ئیتاڵیا — Patente B</h1>
    <p>پرسیارەکانی ئیتاڵیا هێشتا لە پشکنینی ناوەڕۆکدان. هیچ پرسیارێکی ئەڵمانیا لێرە پیشان نادرێت.</p>
    <button className="country-switch" onClick={() => setSettings({ country: null })}>گۆڕینی وڵات</button>
  </section></main>;
}
