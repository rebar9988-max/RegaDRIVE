import { T } from "../app/strings";
import { Bi } from "../components/Bi";
import { SignIcon } from "../components/SignIcon";
import { CONTENT } from "../app/content";
const SIGNS = CONTENT.signs;

export function Signs() {
  return (
    <div>
      <header className="page-head">
        <h1><Bi t={T.nav.signs} /></h1>
        <p className="small muted"><Bi t={{ ckb: "وێنەکان شێوەی سادەکراوی نیشانە فەرمییەکانن. ژمارەی StVO لە ژێر هەر نیشانەیەکدایە.", de: "Vereinfachte Darstellungen der amtlichen Zeichen. Die StVO-Nummer steht unter jedem Zeichen." }} /></p>
      </header>
      {SIGNS.length === 0 && <p className="notice"><Bi t={T.contentInReview} /></p>}
      <div className="signs-grid">
        {SIGNS.map((s) => (
          <article key={s.id} className="card sign-tile" data-testid="sign">
            <SignIcon sign={s} />
            <Bi t={s.name} />
            <span className="badge badge-outline" dir="ltr">Zeichen {s.stvoNumber}</span>
            <p className="small muted"><Bi t={s.meaning} /></p>
          </article>
        ))}
      </div>
    </div>
  );
}
