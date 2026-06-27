import { getSingletonHighlighter, bundledLanguages, type BundledLanguage } from "shiki";
import type { HighlightToken } from "./github/types";

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  cs: "csharp", cpp: "cpp", cc: "cpp", c: "c", h: "c", hpp: "cpp",
  css: "css", scss: "scss", less: "less", html: "html", htm: "html",
  json: "json", jsonc: "jsonc", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", mdx: "mdx",
  sh: "bash", bash: "bash", zsh: "bash",
  sql: "sql", graphql: "graphql", gql: "graphql",
  xml: "xml", svg: "xml", svelte: "svelte", vue: "vue",
  tf: "terraform", hcl: "hcl",
  dockerfile: "dockerfile",
  prisma: "prisma",
};

function detectLang(filePath: string): BundledLanguage | null {
  const filename = filePath.split("/").pop() ?? "";
  // Handle extensionless files like Dockerfile
  if (filename.toLowerCase() === "dockerfile") return "dockerfile" as BundledLanguage;

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const lang = EXT_LANG[ext];
  if (!lang || !(lang in bundledLanguages)) return null;
  return lang as BundledLanguage;
}

const highlighterPromise = getSingletonHighlighter({
  themes: ["github-light", "github-dark"],
  langs: [],
});

export async function highlightCode(
  code: string,
  filePath: string,
): Promise<HighlightToken[][] | null> {
  const lang = detectLang(filePath);
  if (!lang) return null;

  try {
    const highlighter = await highlighterPromise;

    if (!highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(lang);
    }

    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });

    return tokens.map((line) =>
      line.map((t) => ({
        content: t.content,
        htmlStyle: t.htmlStyle,
      })),
    );
  } catch {
    return null;
  }
}
