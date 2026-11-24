import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code's folder is not part of this tree: task worktrees are
    // sibling checkouts, and session evidence holds built and scratch files
    // that are not lint targets (LATER row 487).
    ".claude/**",
  ]),
]);

export default eslintConfig;
