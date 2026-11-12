import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "../app/state";
import { QuestionMedia } from "../components/QuestionMedia";
import { recordPlay, type PlayCounts } from "../lib/mediaPlays";
import type { MediaRef } from "../content/types";

/**
 * PREVIEW BUILDS ONLY (never in production: main.tsx loads this only when VITE_CONTENT_MODE is "preview",
 * and preflight rejects it in a production bundle). Lets the browser tests render the real media viewer with
 * synthetic test-pattern files, since no question has approved media yet.
 */
function Host({ media, exam }: { media: MediaRef[]; exam: boolean }) {
  const [counts, setCounts] = useState<PlayCounts>({});
  return (
    <section className="card stack" data-testid="media-test-host">
      {media.map((m) => <QuestionMedia key={m.key} media={m} plays={exam && m.kind === "video" ? { counts, onPlay: (k) => setCounts((c) => recordPlay(c, k)) } : undefined} />)}
    </section>
  );
}

export function installMediaTestHook() {
  (window as Window & { __rdMountMedia?: (media: MediaRef[], exam: boolean) => void }).__rdMountMedia = (media, exam) => {
    const el = document.createElement("div");
    document.querySelector("main#main")?.prepend(el);
    createRoot(el).render(<AppProvider><Host media={media} exam={exam} /></AppProvider>);
  };
}
