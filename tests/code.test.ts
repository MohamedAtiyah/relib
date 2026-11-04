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
