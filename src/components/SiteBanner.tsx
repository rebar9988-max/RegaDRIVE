import { Link } from "../app/router";

/**
 * RegaDRIVE — Banner (brand identity), an independent component placed directly under the header.
 *
 * It carries the official RegaDRIVE mark — steering wheel, road, traffic light and the "Regadrive"
 * wordmark with its swoosh — on the green-and-white premium glass artwork the owner approved on
 * 2026-11-26, so the banner and the app share one palette. No header control is rendered here.
 * The art is a fixed 3:1 asset; the smaller file serves phones so the first screen stays light.
 */
export function SiteBanner() {
  return (
    <div className="site-banner">
      <Link href="/" className="brand" aria-label="RegaDRIVE">
        <img
          src="/brand/regadrive-banner.webp"
          srcSet="/brand/regadrive-banner-1200.webp 1200w, /brand/regadrive-banner.webp 1668w"
          sizes="(min-width: 1100px) 1100px, 100vw"
          width={1668}
          height={556}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </Link>
    </div>
  );
}
