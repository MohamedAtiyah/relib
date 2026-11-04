import { runPython } from "./python";

export const OPERATIONS = {
  solve: "Solve for a variable",
  simplify: "Simplify",
  expand: "Expand",
  factor: "Factor",
  diff: "Differentiate",
  integrate: "Integrate",
  definite: "Integrate between bounds",
  limit: "Limit",
  evalf: "Evaluate numerically",
  system: "Solve a system",
  det: "Determinant",
  inverse: "Inverse",
  eigen: "Eigenvalues",
  units: "Evaluate with units",
} as const;
export type Operation = keyof typeof OPERATIONS;

// Every answer comes from SymPy in the page's own Python session, never from the language model.
const SCRIPT = String.raw`
%pip install antlr4-python3-runtime==4.11
import json, re
import sympy as sp
from sympy.parsing.latex import parse_latex
from sympy.physics import units as u
from sympy.physics.units import convert_to

UNITS = {"kg": u.kg, "g": u.gram, "m": u.meter, "km": u.km, "cm": u.cm, "mm": u.mm, "s": u.second, "min": u.minute, "h": u.hour,
         "N": u.newton, "J": u.joule, "W": u.watt, "Pa": u.pascal, "C": u.coulomb, "V": u.volt, "A": u.ampere, "K": u.kelvin,
         "mol": u.mol, "Hz": u.hertz, "L": u.liter}
DERIVED = [u.newton, u.joule, u.watt, u.pascal, u.meter / u.second, u.meter / u.second**2, u.volt, u.coulomb, u.hertz]

def tidy(t):
    t = re.sub(r"\\left|\\right|\\[,;:!]|\\quad|\\qquad", " ", t)
    t = t.replace("\\dfrac", "\\frac").replace("\\tfrac", "\\frac")
    return t.strip()

def parse(t):
    return parse_latex(tidy(t))

def matrix(t):
    body = re.search(r"\\begin\{[pbvBV]?matrix\}(.*)\\end\{[pbvBV]?matrix\}", t, re.S)
    if not body:
        raise ValueError("Write the matrix with the matrix button, e.g. a 2x2 matrix.")
    rows = [r for r in body.group(1).split("\\\\") if r.strip()]
    return sp.Matrix([[parse(c) for c in r.split("&")] for r in rows])

def pick_var(e, name):
    if name:
        return sp.Symbol(name)
    free = sorted(e.free_symbols, key=lambda s: (s.name not in ("x", "y", "z", "t"), s.name))
    return free[0] if free else sp.Symbol("x")

def solutions(var, sols):
    if not sols:
        return "\\text{no solution}"
    return ",\\quad ".join(f"{sp.latex(var)} = {sp.latex(s)}" for s in sols)

def run(src, op, name, a, b):
    if op in ("det", "inverse", "eigen"):
        m = matrix(src)
        if op == "det":
            return sp.latex(m.det())
        if op == "inverse":
            return sp.latex(m.inv())
        return ",\\quad ".join(f"\\lambda = {sp.latex(k)}\\ (\\times {v})" for k, v in m.eigenvals().items())
    if op == "units":
        found = {}
        def swap(match):
            if match.group(1) not in UNITS:
                return match.group(0)
            key = f"U_{{{len(found)}}}"
            found[sp.Symbol(key)] = UNITS[match.group(1)]
            return f" {key} "
        e = parse(re.sub(r"\\(?:text|mathrm)\{(\w+)\}", swap, src)).subs(found)
        for target in DERIVED:
            c = convert_to(e, target)
            if (c / target).is_number:
                return sp.latex(c)
        return sp.latex(sp.simplify(e))
    if op == "system":
        eqs = [parse(p) for p in re.split(r"\\\\|;", re.sub(r"\\begin\{(aligned|cases)\}|\\end\{(aligned|cases)\}|&", "", src)) if p.strip()]
        syms = sorted(set().union(*[q.free_symbols for q in eqs]), key=lambda s: s.name)
        sol = sp.solve(eqs, syms, dict=True)
        return "\\text{no solution}" if not sol else "\\quad\\text{or}\\quad ".join(", ".join(f"{sp.latex(k)} = {sp.latex(v)}" for k, v in s.items()) for s in sol)
    e = parse(src)
    var = pick_var(e, name)
    if op == "solve":
        return solutions(var, sp.solve(e if isinstance(e, sp.Equality) else sp.Eq(e, 0), var))
    if isinstance(e, sp.Equality):
        e = e.lhs - e.rhs
    if op == "simplify":
        return sp.latex(sp.simplify(e))
    if op == "expand":
        return sp.latex(sp.expand(e))
    if op == "factor":
        return sp.latex(sp.factor(e))
    if op == "diff":
        return sp.latex(sp.diff(e, var))
    if op == "integrate":
        return sp.latex(sp.integrate(e, var)) + " + C"
    if op == "definite":
        return sp.latex(sp.integrate(e, (var, parse(a), parse(b))))
    if op == "limit":
        return sp.latex(sp.limit(e, var, parse(a or "0")))
    if op == "evalf":
        return sp.latex(e.evalf(10))
    raise ValueError("Unknown operation")

try:
    print("__SYMPY__" + json.dumps({"latex": run(SRC, OP, VAR, A, B)}))
except Exception as err:
    print("__SYMPY__" + json.dumps({"error": f"{type(err).__name__}: {err}"}))
`;

export type SolveResult = { latex?: string; error?: string };

export async function solveWithSympy(latex: string, op: Operation, session: string, opts: { variable?: string; a?: string; b?: string } = {}): Promise<SolveResult> {
  // values go in as JSON literals, which are valid Python strings, so nothing the student typed becomes code
  const head = `SRC = ${JSON.stringify(latex)}\nOP = ${JSON.stringify(op)}\nVAR = ${JSON.stringify(opts.variable ?? "")}\nA = ${JSON.stringify(opts.a ?? "")}\nB = ${JSON.stringify(opts.b ?? "")}\n`;
  const [pip, ...rest] = SCRIPT.trim().split("\n");
  const result = await runPython(`${pip}\n${head}${rest.join("\n")}`, session);
  const line = result.output.split("\n").find((l) => l.startsWith("__SYMPY__"));
  if (!line) return { error: result.output.trim().split("\n").at(-1) || "SymPy did not return a result." };
  return JSON.parse(line.slice("__SYMPY__".length));
}
