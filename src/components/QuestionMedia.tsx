import { useId, useRef, useState } from "react";
import type { MediaRef } from "../content/types";
import { T } from "../app/strings";
import { useBiText } from "./Bi";
import { Icon } from "./Icon";
import { MAX_VIDEO_PLAYS, nextZoom, playsLeft, type PlayCounts } from "../lib/mediaPlays";

const src = (key: string) => `/media/${key.replace(/^media\//, "")}`;

interface Props {
  media: MediaRef;
  /** Exam mode: limit video plays (counts are owned by the caller so they survive a reload). */
  plays?: { counts: PlayCounts; onPlay: (key: string) => void };
}

/**
 * Question image or video. Fixed 16:9 frame (no layout shift), lazy loading, never autoplays or preloads video.
 * Images: zoom in / out and full screen. Videos: native controls, poster frame, optional play limit.
 */
export function QuestionMedia({ media, plays }: Props) {
  const label = useBiText();
  const frame = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const statusId = useId();
  const left = plays ? playsLeft(plays.counts, media.key) : null;
  const locked = left === 0;
  const alt = label(media.alt);

  const fullscreen = () => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => undefined);
  };
  // Each start of playback counts once. The fifth play runs to its end; only starting a sixth is stopped.
  const onPlay = () => {
    if (!plays || !video.current) return;
    if (locked) { video.current.pause(); return; }
    setPlaying(true);
    plays.onPlay(media.key);
  };
  const stopped = () => setPlaying(false);

  if (failed) {
    return <figure className="q-media q-media-failed" role="img" aria-label={alt} data-testid="media-failed"><figcaption className="small muted">{label(T.mediaUnavailable)}</figcaption></figure>;
  }
  return (
    <figure ref={frame} className={`q-media q-media-${media.kind}`} data-testid={`media-${media.kind}`}>
      {/* The image stage scrolls when zoomed, so keyboard users can focus it and move with the arrow keys. */}
      <div className="q-media-stage" {...(media.kind === "image" ? { tabIndex: 0, role: "group", "aria-label": alt } : {})}>
        {media.kind === "image"
          ? <img src={src(media.key)} alt={alt} loading="lazy" decoding="async" style={zoom > 1 ? { transform: `scale(${zoom})` } : undefined} onError={() => setFailed(true)} data-zoom={zoom} />
          : <video ref={video} src={src(media.key)} poster={media.posterKey ? src(media.posterKey) : undefined} controls={!locked || playing} playsInline preload="none"
              controlsList="nodownload noplaybackrate" disablePictureInPicture aria-label={alt} aria-describedby={plays ? statusId : undefined}
              onPlay={onPlay} onPause={stopped} onEnded={stopped} onError={() => setFailed(true)} />}
      </div>
      <div className="q-media-tools">
        {media.kind === "image" && <>
          <button type="button" className="icon-button" onClick={() => setZoom((z) => nextZoom(z, -1))} disabled={zoom <= 1} aria-label={label(T.zoomOut)} data-testid="zoom-out"><Icon name="zoomOut" /></button>
          <button type="button" className="icon-button" onClick={() => setZoom((z) => nextZoom(z, 1))} disabled={zoom >= 3} aria-label={label(T.zoomIn)} data-testid="zoom-in"><Icon name="zoomIn" /></button>
        </>}
        {plays && <span id={statusId} className="small q-media-plays" role="status" data-testid="plays-left">
          {locked ? label(T.playsUsed) : `${label(T.playsLeft)}: `}{!locked && <span className="num" dir="ltr">{left} / {MAX_VIDEO_PLAYS}</span>}
        </span>}
        <button type="button" className="icon-button" onClick={fullscreen} aria-label={label(T.fullscreen)} data-testid="fullscreen"><Icon name="fullscreen" /></button>
      </div>
    </figure>
  );
}
