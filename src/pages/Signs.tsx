import { Link } from "../app/router";
import { T } from "../app/strings";
import { Bi } from "../components/Bi";
import { SignIcon } from "../components/SignIcon";
import { useApproved } from "../app/approved";

export function Signs() {
  const { signs: SIGNS, loading } = useApproved();
  return (
    <div>
      <header className="page-head">
        <h1><Bi t={T.nav.signs} /></h1>
        <p className="small muted"><Bi t={{ ckb: "وێنەکان شێوەی سادەکراوی نیشانە فەرمییەکانن. ژمارەی StVO لە ژێر هەر نیشانەیەکدایە.", de: "Vereinfachte Darstellungen der amtlichen Zeichen. Die StVO-Nummer steht unter jedem Zeichen.", kmr: "Wêne şiklên sadekirî yên nîşaneyên fermî ne. Hejmara StVO di bin her nîşaneyê de ye.", ar: "رسوم مبسّطة للإشارات الرسمية. رقم StVO مكتوب أسفل كل إشارة." }} /></p>
      </header>
      <p><Link className="btn btn-primary" href="/sign-quiz" data-testid="sign-quiz-link"><Bi t={{ ckb: "تاقیکردنەوەی نیشانەکان", de: "Verkehrszeichen-Quiz", kmr: "Ezmûna nîşaneyan", ar: "اختبار الإشارات" }} /></Link></p>
      {!loading && SIGNS.length === 0 && <p className="notice"><Bi t={T.contentInReview} /></p>}
      <div className="signs-grid">
        {SIGNS.map((s) => (
          <article key={s.id} className="card sign-tile" data-testid="sign">
            <SignIcon sign={s} />
            <Bi t={s.name} />
            <span className="badge badge-outline" dir="ltr">Zeichen {s.stvoNumber}</span>
            <span className="small muted" dir="ltr">StVO Anlage {s.anlage} · lfd. Nr. {s.lfdNr}</span>
            <p className="small muted"><Bi t={s.meaning} /></p>
          </article>
        ))}
      </div>
    </div>
  );
}
