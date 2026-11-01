// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import en from "@/locales/en.json";

describe("visible source text", () => {
  it("keeps interface copy in resources and every literal translation key defined", () => {
    const root = path.resolve("src");
    const failures: string[] = [];
    const technical = new Set([
      "TGFlow",
      "Telegram",
      "GitHub",
      "API",
      "ms",
      "x",
      "/s",
      "/s · ↓",
    ]);
    const allowed = (text: string) =>
      technical.has(text) || /^(https?:|socks:|mtproto:)/.test(text);
    for (const file of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(file) || file.includes(".test.")) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const fail = (node: ts.Node, text: string) =>
        failures.push(
          `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${text}`,
        );
      function visit(node: ts.Node) {
        if (ts.isJsxText(node)) {
          const text = node.text.replace(/\s+/g, " ").trim();
          if (/[A-Za-z\u4e00-\u9fff]/.test(text) && !allowed(text))
            fail(node, text);
        }
        if (
          ts.isJsxAttribute(node) &&
          /^(title|label|placeholder|alt|aria-label|ariaLabel|description)$/.test(
            node.name.getText(source),
          ) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        ) {
          const text = node.initializer.text;
          if (/[A-Za-z\u4e00-\u9fff]/.test(text) && !allowed(text))
            fail(node, text);
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "t"
        ) {
          const key = node.arguments[0];
          if (key && ts.isStringLiteral(key) && !(key.text in en))
            fail(node, `Missing resource: ${key.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(failures).toEqual([]);
  });
});
