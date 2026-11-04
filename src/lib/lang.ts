import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

const REGISTERED = { python, javascript, typescript, sql, xml, css, c, cpp, java, go, rust, bash };
for (const [name, lang] of Object.entries(REGISTERED)) hljs.registerLanguage(name, lang);

export const LANGUAGES = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  c: "C",
  cpp: "C++",
  java: "Java",
  go: "Go",
  rust: "Rust",
} as const;
export type Language = keyof typeof LANGUAGES;

// Where each language runs: the browser where it can, the cloud sandbox for compiled languages.
export const RUNTIME: Record<Language, "pyodide" | "js" | "sql" | "preview" | "cloud"> = {
  python: "pyodide",
  javascript: "js",
  typescript: "js",
  sql: "sql",
  html: "preview",
  css: "preview",
  c: "cloud",
  cpp: "cloud",
  java: "cloud",
  go: "cloud",
  rust: "cloud",
};

const HLJS_NAME: Record<Language, string> = { python: "python", javascript: "javascript", typescript: "typescript", sql: "sql", html: "xml", css: "css", c: "c", cpp: "cpp", java: "java", go: "go", rust: "rust" };

// Strong signals first: highlight.js alone mixes up C and C++, and JavaScript and TypeScript.
export function detectLanguage(code: string): Language | null {
  const text = code.trim();
  if (text.length < 4) return null;
  if (/#include\s*<(iostream|vector|string|map)>|std::|cout\s*<</.test(text)) return "cpp";
  if (/#include\s*<stdio\.h>|printf\s*\(/.test(text) && !/std::/.test(text)) return "c";
  if (/public\s+(static\s+)?class\s|System\.out\.print/.test(text)) return "java";
  if (/^package\s+main\b|fmt\.Print/m.test(text)) return "go";
  if (/fn\s+main\s*\(\)|println!\s*\(/.test(text)) return "rust";
  if (/^\s*(def |import |from \S+ import |print\()/m.test(text) && !/[;{}]\s*$/m.test(text)) return "python";
  if (/^\s*(select|create\s+table|insert\s+into|update|delete\s+from|with)\b/im.test(text) && /;|\bfrom\b|\btable\b/i.test(text)) return "sql";
  if (/^\s*<(!doctype|html|div|body|head|p|h1|section|script)/i.test(text)) return "html";
  if (/:\s*(string|number|boolean)\b|\binterface\s+\w+|\btype\s+\w+\s*=/.test(text)) return "typescript";
  const guess = hljs.highlightAuto(text, Object.values(HLJS_NAME)).language;
  const found = (Object.keys(HLJS_NAME) as Language[]).find((l) => HLJS_NAME[l] === guess);
  return found ?? null;
}

export const highlightCode = (code: string, language: Language) => hljs.highlight(code, { language: HLJS_NAME[language], ignoreIllegals: true }).value;
