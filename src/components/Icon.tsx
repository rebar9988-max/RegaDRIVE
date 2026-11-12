import { ICON_PATHS } from "./icons.generated";

/**
 * Icons: bold outlines from Phosphor Icons (MIT licence), generated into icons.generated.ts by
 * scripts/generate-icons.mjs so the app ships only the shapes it draws. Decorative: always aria-hidden.
 */
export type IconName = keyof typeof ICON_PATHS;
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      {ICON_PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
