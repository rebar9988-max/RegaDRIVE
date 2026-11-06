import { Link } from "../app/router";
import { T } from "../app/strings";
import { Bi } from "./Bi";

/** One consistent "content in review" state for every content page. Offers only next steps that work. */
export function ContentStatus({ testId = "content-status" }: { testId?: string }) {
  return (
    <section className="card stack" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <h2 id={`${testId}-title`} className="section-title"><Bi t={T.statusTitle} /></h2>
      <Bi t={T.contentInReview} />
      <p className="small muted"><Bi t={T.statusNoFake} /></p>
      <div className="q-actions">
        <Link href="/about" className="btn btn-secondary"><Bi t={T.statusAbout} /></Link>
        <Link href="/settings" className="btn btn-secondary"><Bi t={T.statusSettings} /></Link>
      </div>
    </section>
  );
}
