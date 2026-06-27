import prettier from "prettier";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";
import htmlPlugin from "prettier/plugins/html";
import postcssPlugin from "prettier/plugins/postcss";
import typescriptPlugin from "prettier/plugins/typescript";

type ParserEntry = { parser: string; plugins: prettier.Plugin[] };

const PARSER: Record<string, ParserEntry> = {
  js:   { parser: "babel",      plugins: [babelPlugin, estreePlugin] },
  mjs:  { parser: "babel",      plugins: [babelPlugin, estreePlugin] },
  cjs:  { parser: "babel",      plugins: [babelPlugin, estreePlugin] },
  jsx:  { parser: "babel",      plugins: [babelPlugin, estreePlugin] },
  ts:   { parser: "typescript", plugins: [typescriptPlugin, estreePlugin] },
  tsx:  { parser: "typescript", plugins: [typescriptPlugin, estreePlugin] },
  css:  { parser: "css",        plugins: [postcssPlugin] },
  scss: { parser: "scss",       plugins: [postcssPlugin] },
  less: { parser: "less",       plugins: [postcssPlugin] },
  json: { parser: "json",       plugins: [babelPlugin, estreePlugin] },
  svg:  { parser: "html",       plugins: [htmlPlugin] },
  html: { parser: "html",       plugins: [htmlPlugin] },
  htm:  { parser: "html",       plugins: [htmlPlugin] },
};

export function isMinified(content: string): boolean {
  return content.split("\n").some((line) => line.length > 100);
}

export async function formatCode(
  content: string,
  filePath: string,
  { alwaysFormat = false }: { alwaysFormat?: boolean } = {},
): Promise<string> {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const entry = PARSER[ext];
  if (!entry) return content;
  if (!alwaysFormat && !isMinified(content)) return content;

  try {
    return await prettier.format(content, {
      parser: entry.parser,
      plugins: entry.plugins,
      printWidth: 80,
      tabWidth: 2,
      semi: true,
    });
  } catch {
    return content;
  }
}
