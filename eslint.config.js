import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".wrangler", ".wrangler-dry", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker } },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  { files: ["**/*.{js,mjs}"], languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.serviceworker } } },
);
