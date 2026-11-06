import type { MediaRef } from "../content/types";
import { useBiText } from "./Bi";

/** Question image or video. Fixed aspect ratio prevents layout shift; videos never autoplay or preload. */
export function QuestionMedia({ media }: { media: MediaRef }) {
  const label = useBiText();
  const src = `/media/${media.key.replace(/^media\//, "")}`;
  return (
    <figure className="q-media" data-testid={`media-${media.kind}`}>
      {media.kind === "image"
        ? <img src={src} alt={label(media.alt)} loading="lazy" decoding="async" />
        : <video src={src} poster={media.posterKey ? `/media/${media.posterKey.replace(/^media\//, "")}` : undefined}
            controls playsInline preload="none" controlsList="nodownload" aria-label={label(media.alt)} />}
    </figure>
  );
}
