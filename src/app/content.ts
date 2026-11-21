import { contentFor, type ContentMode } from "../content/access";
import { itContentFor } from "../content/italy/access";

export const CONTENT_MODE: ContentMode = import.meta.env.VITE_CONTENT_MODE === "preview" ? "preview" : "production";
/** The German content the app may show in this build. */
export const CONTENT = contentFor(CONTENT_MODE);
/** The Italian content the app may show in this build. The two banks are never mixed. */
export const IT_CONTENT = itContentFor(CONTENT_MODE);
