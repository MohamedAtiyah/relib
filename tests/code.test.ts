import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveImports } from "../src/lib/jsrun";
import { detectLanguage } from "../src/lib/lang";
import { parseSchema } from "../src/lib/sqlrun";

test("detectLanguage tells pasted languages apart", () => {
  assert.equal(detectLanguage('#include <iostream>\nint main() { std::cout << "hi"; }'), "cpp");
  assert.equal(detectLanguage('#include <stdio.h>\nint main() { printf("hi"); }'), "c");
  assert.equal(detectLanguage('public class Main { public static void main(String[] a) { System.out.println("hi"); } }'), "java");
  assert.equal(detectLanguage("import numpy as np\nprint(np.arange(3))"), "python");
  assert.equal(detectLanguage('import _ from "lodash";\nconsole.log(_.chunk([1, 2, 3], 2));'), "javascript");
  assert.equal(detectLanguage("const n: number = 3;\nconsole.log(n);"), "typescript");
  assert.equal(detectLanguage("SELECT name FROM students WHERE year = 2;"), "sql");
  assert.equal(detectLanguage("package main\nimport \"fmt\"\nfunc main() { fmt.Println(1) }"), "go");
  assert.equal(detectLanguage('fn main() { println!("hi"); }'), "rust");
});

test("resolveImports sends bare packages to esm.sh and leaves paths alone", () => {
  const { code, packages } = resolveImports('import _ from "lodash";\nimport x from "./x.js";\nconst d = await import("dayjs");');
  assert.match(code, /from "https:\/\/esm\.sh\/lodash"/);
  assert.match(code, /from "\.\/x\.js"/);
  assert.match(code, /import\("https:\/\/esm\.sh\/dayjs"\)/);
  assert.deepEqual(packages, ["lodash", "dayjs"]);
});

test("parseSchema reads columns, keys and references", () => {
  const tables = parseSchema(`
    CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, grade DECIMAL(4, 2));
    CREATE TABLE enrolments (
      student_id INTEGER REFERENCES students(id),
      course_id INTEGER,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );`);
  assert.deepEqual(tables.map((t) => t.name), ["students", "enrolments"]);
  assert.deepEqual(tables[0].columns.map((c) => [c.name, c.type, Boolean(c.key)]), [
    ["id", "INTEGER", true],
    ["name", "TEXT", false],
    ["grade", "DECIMAL(4, 2)", false],
  ]);
  assert.deepEqual(tables[1].columns.map((c) => [c.name, c.ref, Boolean(c.key)]), [
    ["student_id", "students", true],
    ["course_id", "courses", true],
  ]);
});

test("notebooks survive a round trip through .ipynb", async () => {
  const { fromIpynb, toIpynb } = await import("../src/lib/notebook");
  const cells = [
    { id: "a", kind: "text" as const, source: "# Title\nSome text" },
    { id: "b", kind: "code" as const, source: "x = 1\nprint(x)", output: "1\n", images: ["iVBOR"] },
  ];
  const back = fromIpynb(JSON.parse(JSON.stringify(toIpynb(cells))));
  assert.deepEqual(
    back.map(({ kind, source, output, images }) => ({ kind, source, output, images })),
    [
      { kind: "text", source: "# Title\nSome text", output: undefined, images: [] },
      { kind: "code", source: "x = 1\nprint(x)", output: "1\n", images: ["iVBOR"] },
    ],
  );
});

test("inlineWebProject puts local CSS and JS into the page", async () => {
  const { inlineWebProject } = await import("../src/lib/notebook");
  const html = inlineWebProject([
    { path: "index.html", content: '<link rel="stylesheet" href="styles.css"><script src="app.js"></script><script src="https://cdn.x/y.js"></script>' },
    { path: "styles.css", content: "body{color:red}" },
    { path: "app.js", content: "console.log(1)" },
  ]);
  assert.match(html, /<style>body\{color:red\}<\/style>/);
  assert.match(html, /<script>console\.log\(1\)<\/script>/);
  assert.match(html, /https:\/\/cdn\.x\/y\.js/);
});
