import katex from "katex";
import "katex/contrib/mhchem";

// Live conversion while typing, on top of MathLive's own (Greek names, fractions with /, ^ and _).
export const SHORTCUTS: Record<string, string> = {
  "->": "\\to",
  "<-": "\\leftarrow",
  "<->": "\\leftrightarrow",
  "=>": "\\Rightarrow",
  "<=>": "\\Leftrightarrow",
  "<=": "\\le",
  ">=": "\\ge",
  "!=": "\\ne",
  "~=": "\\approx",
  "+-": "\\pm",
  "-+": "\\mp",
  inf: "\\infty",
  infinity: "\\infty",
  deg: "^{\\circ}",
  "...": "\\ldots",
  "*": "\\times",
  in: "\\in",
  notin: "\\notin",
  sub: "\\subset",
  sube: "\\subseteq",
  union: "\\cup",
  inter: "\\cap",
  forall: "\\forall",
  exists: "\\exists",
  nabla: "\\nabla",
  partial: "\\partial",
  "sqrt(": "\\sqrt{#?}",
  "root3(": "\\sqrt[3]{#?}",
  "abs(": "\\left|#?\\right|",
  sum: "\\sum_{#?}^{#?}",
  prod: "\\prod_{#?}^{#?}",
  int: "\\int_{#?}^{#?}",
  iint: "\\iint",
  oint: "\\oint",
  lim: "\\lim_{#?}",
  "d/dx": "\\frac{d}{dx}",
  matrix: "\\begin{pmatrix}#? & #? \\\\ #? & #?\\end{pmatrix}",
  cases: "\\begin{cases}#? & #? \\\\ #? & #?\\end{cases}",
};

// The palette: every group from the spec, searchable by name. Each entry is "name latex".
const GROUPS: Record<string, string> = {
  "Greek (lower)":
    "alpha \\alpha|beta \\beta|gamma \\gamma|delta \\delta|epsilon \\epsilon|varepsilon \\varepsilon|zeta \\zeta|eta \\eta|theta \\theta|vartheta \\vartheta|iota \\iota|kappa \\kappa|lambda \\lambda|mu \\mu|nu \\nu|xi \\xi|omicron o|pi \\pi|varpi \\varpi|rho \\rho|varrho \\varrho|sigma \\sigma|varsigma \\varsigma|tau \\tau|upsilon \\upsilon|phi \\phi|varphi \\varphi|chi \\chi|psi \\psi|omega \\omega",
  "Greek (upper)": "Gamma \\Gamma|Delta \\Delta|Theta \\Theta|Lambda \\Lambda|Xi \\Xi|Pi \\Pi|Sigma \\Sigma|Upsilon \\Upsilon|Phi \\Phi|Psi \\Psi|Omega \\Omega",
  "Hebrew and others": "aleph \\aleph|beth \\beth|hbar \\hbar|ell \\ell|weierstrass p \\wp|real part \\Re|imaginary part \\Im",
  Operators:
    "plus +|minus -|times \\times|divide \\div|dot \\cdot|asterisk \\ast|star \\star|compose \\circ|bullet \\bullet|direct sum \\oplus|tensor product \\otimes|circled minus \\ominus|circled dot \\odot|and \\wedge|or \\vee|intersection \\cap|union \\cup|multiset union \\uplus|set minus \\setminus|wreath \\wr|square cap \\sqcap|square cup \\sqcup|dagger \\dagger|double dagger \\ddagger",
  Relations:
    "equals =|not equal \\ne|approximately \\approx|congruent \\cong|identical \\equiv|similar \\sim|similar equal \\simeq|proportional \\propto|less <|greater >|less or equal \\le|greater or equal \\ge|much less \\ll|much greater \\gg|precedes \\prec|succeeds \\succ|precedes or equal \\preceq|succeeds or equal \\succeq|subset \\subset|superset \\supset|subset or equal \\subseteq|superset or equal \\supseteq|proper subset \\subsetneq|proper superset \\supsetneq|element of \\in|not element of \\notin|contains \\ni|perpendicular \\perp|parallel \\parallel|divides \\mid|proves \\vdash|models \\models|approaches \\doteq|defined as \\triangleq",
  Arrows:
    "left arrow \\leftarrow|right arrow \\rightarrow|up arrow \\uparrow|down arrow \\downarrow|left right arrow \\leftrightarrow|up down arrow \\updownarrow|implied by \\Leftarrow|implies \\Rightarrow|double up \\Uparrow|double down \\Downarrow|if and only if \\Leftrightarrow|maps to \\mapsto|hook right \\hookrightarrow|hook left \\hookleftarrow|harpoon up \\rightharpoonup|harpoon down \\rightharpoondown|equilibrium \\rightleftharpoons|long right arrow \\longrightarrow|long implies \\Longrightarrow|north east \\nearrow|south east \\searrow|south west \\swarrow|north west \\nwarrow|labelled arrow \\xrightarrow{#?}",
  "Big operators":
    "sum \\sum_{#?}^{#?}|product \\prod_{#?}^{#?}|coproduct \\coprod|integral \\int_{#?}^{#?}|double integral \\iint|triple integral \\iiint|contour integral \\oint|big union \\bigcup|big intersection \\bigcap|big direct sum \\bigoplus|big tensor \\bigotimes|big or \\bigvee|big and \\bigwedge",
  Calculus:
    "derivative \\frac{d}{dx}|partial derivative \\frac{\\partial}{\\partial x}|prime f'|dot derivative \\dot{x}|second dot \\ddot{x}|limit \\lim_{x\\to #?}|nabla \\nabla|laplacian \\nabla^2|differential \\mathrm{d}x|integral with bounds \\int_{a}^{b} #? \\,\\mathrm{d}x",
  "Sets and logic":
    "empty set \\emptyset|naturals \\mathbb{N}|integers \\mathbb{Z}|rationals \\mathbb{Q}|reals \\mathbb{R}|complex \\mathbb{C}|for all \\forall|exists \\exists|not exists \\nexists|not \\neg|and \\land|or \\lor|top \\top|bottom \\bot|therefore \\therefore|because \\because|set builder \\left\\{ #? \\mid #? \\right\\}",
  Fonts:
    "blackboard bold \\mathbb{#?}|calligraphic \\mathcal{#?}|fraktur \\mathfrak{#?}|script \\mathscr{#?}|bold \\mathbf{#?}|bold vector \\boldsymbol{#?}|sans serif \\mathsf{#?}|monospace \\mathtt{#?}|text \\text{#?}",
  Accents:
    "hat \\hat{#?}|bar \\bar{#?}|overline \\overline{#?}|vector \\vec{#?}|dot \\dot{#?}|double dot \\ddot{#?}|tilde \\tilde{#?}|wide hat \\widehat{#?}|wide tilde \\widetilde{#?}|over arrow \\overrightarrow{#?}|underline \\underline{#?}|over brace \\overbrace{#?}^{#?}|under brace \\underbrace{#?}_{#?}",
  Brackets:
    "parentheses \\left( #? \\right)|square brackets \\left[ #? \\right]|braces \\left\\{ #? \\right\\}|angle brackets \\left\\langle #? \\right\\rangle|absolute value \\left\\lvert #? \\right\\rvert|norm \\left\\lVert #? \\right\\rVert|floor \\left\\lfloor #? \\right\\rfloor|ceiling \\left\\lceil #? \\right\\rceil",
  Structures:
    "fraction \\frac{#?}{#?}|display fraction \\dfrac{#?}{#?}|continued fraction \\cfrac{#?}{#?+\\cfrac{#?}{#?}}|binomial \\binom{#?}{#?}|square root \\sqrt{#?}|nth root \\sqrt[#?]{#?}|matrix \\begin{pmatrix}#? & #? \\\\ #? & #?\\end{pmatrix}|bracket matrix \\begin{bmatrix}#? & #? \\\\ #? & #?\\end{bmatrix}|determinant \\begin{vmatrix}#? & #? \\\\ #? & #?\\end{vmatrix}|piecewise \\begin{cases}#? & #? \\\\ #? & #?\\end{cases}|aligned \\begin{aligned}#? &= #? \\\\ &= #?\\end{aligned}|stacked limits \\sum_{\\substack{#? \\\\ #?}}",
  Functions:
    "sine \\sin|cosine \\cos|tangent \\tan|secant \\sec|cosecant \\csc|cotangent \\cot|arcsine \\arcsin|arccosine \\arccos|arctangent \\arctan|hyperbolic sine \\sinh|hyperbolic cosine \\cosh|hyperbolic tangent \\tanh|log \\log|natural log \\ln|exponential \\exp|limit \\lim|supremum \\sup|infimum \\inf|maximum \\max|minimum \\min|determinant \\det|dimension \\dim|gcd \\gcd|mod \\bmod|operator name \\operatorname{#?}",
  Chemistry: "chemical formula \\ce{H2O}|reaction \\ce{2H2 + O2 -> 2H2O}|equilibrium reaction \\ce{A <=> B}|state symbols \\ce{NaCl(aq)}",
  "Units and physics": "kilogram 5\\,\\text{kg}|metre per second \\text{m}/\\text{s}|unit vector \\hat{\\mathbf{i}}|bra \\langle #? \\vert|ket \\vert #? \\rangle|bra-ket \\langle #? \\vert #? \\rangle|degree ^{\\circ}",
  "Spacing and colour": "thin space \\,|medium space \\:|wide space \\quad|double wide space \\qquad|coloured term \\textcolor{#e07a2e}{#?}",
};

export type Symbol = { name: string; latex: string; group: string };

export const PALETTE: Symbol[] = Object.entries(GROUPS).flatMap(([group, list]) =>
  list.split("|").map((item) => {
    const at = item.indexOf(" \\") >= 0 ? item.indexOf(" \\") : item.lastIndexOf(" ");
    return { group, name: item.slice(0, at), latex: item.slice(at + 1) };
  }),
);

export function renderTex(latex: string, display: boolean): { html: string; error?: string } {
  try {
    return { html: katex.renderToString(latex.replace(/\\text\{#\?\}/g, "\\text{text}").replace(/#\?/g, "\\square"), { displayMode: display, throwOnError: true, output: "htmlAndMathml" }) };
  } catch (err) {
    return { html: "", error: err instanceof Error ? err.message : String(err) };
  }
}
