import { contentFor, type ContentMode } from "../content/access";

export const CONTENT_MODE: ContentMode = import.meta.env.VITE_CONTENT_MODE === "preview" ? "preview" : "production";
/** The content the app may show in this build. */
export const CONTENT = contentFor(CONTENT_MODE);
