import { itSignSrc } from "../content/italy/signs";
import type { ItSign } from "../content/italy/types";
import { useBiText } from "./Bi";

/**
 * Illustration of an Italian sign, served as a file from /signs/it. Meaningful image when a name is
 * wanted, decorative otherwise. The frame is the existing q-media frame, so nothing new is styled.
 */
export function ItSignImage({ sign, labelled = true }: { sign: ItSign; labelled?: boolean }) {
  const label = useBiText();
  const alt = label(sign.name);
  return (
    <figure className="q-media q-media-image" data-testid="it-sign">
      <div className="q-media-stage">
        <img src={itSignSrc(sign)} width={120} height={120} loading="lazy" decoding="async" alt={labelled ? alt : ""} aria-hidden={labelled ? undefined : true} />
      </div>
    </figure>
  );
}
