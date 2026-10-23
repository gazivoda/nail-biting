// ESLint rules that keep English out of the code (WS12a).
//
//   local-i18n/no-hardcoded-text      JSX text, user-facing attributes and string children
//   local-i18n/no-english-literals    sentence-like string literals anywhere else in an in-scope file
//
// "No hardcoded strings remain" is the acceptance line of WS12, so these two are
// errors. What is in scope is decided in ./scope.mjs (default in; exemptions are
// listed there with a reason). Both rules skip a file the scope file excludes.
//
// A deliberate exception takes a same-line comment that says why:
//     <code>        // i18n-ignore: product name
// Anything else goes through t() from src/i18n.
//
// The rules are heuristics for English. They cannot see a string that reaches the
// screen through a helper; the pseudo-locale test (src/i18n/coverage.test.tsx)
// renders the screens and catches those.

import { isExcluded } from './scope.mjs';

/** Names that are not translated: the product and the sign-in providers. */
const KEEP = /Stop Biting|Google|Apple|Microsoft|Paddle|MediaPipe|Chrome|Safari|Firefox|Edge|iOS|Android|macOS|Windows|PWA|Electron/g;

/** JSX attributes (and component props) whose string value a person reads or hears. */
export const TEXT_ATTRIBUTES = new Set([
  'aria-label', 'aria-description', 'aria-roledescription', 'aria-placeholder', 'aria-valuetext',
  'title', 'placeholder', 'alt', 'label', 'tooltip', 'tooltipLabel', 'ariaLabel', 'description',
  'heading', 'subtitle', 'caption', 'hint', 'helperText', 'helper', 'message', 'text', 'summary',
  'legend', 'emptyLabel', 'confirmLabel', 'cancelLabel', 'actionLabel', 'srLabel', 'name_',
]);

/** Object keys whose single capitalised word is still copy (e.g. { label: 'Stress' }). */
const COPY_KEYS = new Set([
  'label', 'title', 'description', 'text', 'message', 'heading', 'placeholder', 'hint', 'subtitle',
  'caption', 'summary', 'body', 'cta', 'tooltip', 'aria', 'ariaLabel', 'name', 'empty', 'note',
]);

const FUNCTION_WORDS = new Set([
  'the', 'and', 'your', 'you', 'to', 'of', 'is', 'are', 'for', 'with', 'in', 'on', 'a', 'an', 'not',
  'no', 'will', 'can', 'this', 'that', 'it', 'or', 'be', 'have', 'has', 'was', 'were', 'when', 'if',
  'we', 'our', 'from', 'at', 'by', 'as', 'out', 'up', 'off', 'all', 'any', 'more', 'than', 'then',
]);

const PURE_WORD = /^[("'“‘]*[A-Za-z][A-Za-z'’]*[)"'”’.,!?:;…]*$/;

/** A run of two or more Latin letters, once product names are removed. */
export function hasEnglishWord(str) {
  return /[A-Za-z]{2,}/.test(str.replace(KEEP, ''));
}

/** A string that reads as English copy (a sentence, a phrase, a capitalised label). */
export function looksLikeEnglishCopy(str) {
  const t = str.replace(KEEP, '').trim();
  if (t.length < 3) return false;
  // CSS media queries read like prose to the heuristics below: "(pointer: coarse) and (max-width: 767px)".
  if (/\b(?:max|min)-(?:width|height)\b|\(\s*(?:pointer|hover|orientation|prefers-[a-z-]+|display-mode)\s*:/.test(t)) return false;
  const tokens = t.split(/\s+/);
  const words = tokens.filter(tok => PURE_WORD.test(tok));
  if (words.length === 0) return false;
  const sentenceCase = /^[("'“‘]*[A-Z][a-z]/.test(t);
  if (tokens.length >= 2 && words.length >= 2 && sentenceCase) return true;
  if (words.length >= 3 && /[.!?…]$/.test(t)) return true;
  if (words.length >= 2 && words.some(w => FUNCTION_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')))) return true;
  return false;
}

function relPath(context) {
  const file = (context.filename ?? context.getFilename()).replace(/\\/g, '/');
  const i = file.lastIndexOf('/src/');
  return i >= 0 ? file.slice(i + 1) : file;
}

function hasIgnoreComment(sourceCode, node) {
  const line = node.loc.end.line;
  return sourceCode.getAllComments().some(c => c.loc.start.line === line && /i18n-ignore/.test(c.value));
}

/** The string pieces an expression can put on the screen without calling anything. */
function literalsIn(expr, out = []) {
  if (!expr) return out;
  switch (expr.type) {
    case 'Literal':
      if (typeof expr.value === 'string') out.push({ node: expr, text: expr.value });
      break;
    case 'TemplateLiteral': {
      // one finding per template, however many `${}` split it
      const text = expr.quasis.map(q => q.value.cooked ?? q.value.raw).join(' ');
      if (text.trim()) out.push({ node: expr, text });
      break;
    }
    case 'ConditionalExpression':
      literalsIn(expr.consequent, out);
      literalsIn(expr.alternate, out);
      break;
    case 'LogicalExpression':
      literalsIn(expr.left, out);
      literalsIn(expr.right, out);
      break;
    case 'BinaryExpression':
      if (expr.operator === '+') {
        literalsIn(expr.left, out);
        literalsIn(expr.right, out);
      }
      break;
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
      literalsIn(expr.expression, out);
      break;
    default:
      break;
  }
  return out;
}

const REPORT = 'Hardcoded text: use t() from src/i18n (or add "// i18n-ignore: <reason>" if it is not for people to read).';

const noHardcodedText = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { hardcoded: REPORT },
  },
  create(context) {
    if (isExcluded(relPath(context))) return {};
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const check = (node, text) => {
      if (!hasEnglishWord(text)) return;
      if (hasIgnoreComment(sourceCode, node)) return;
      context.report({ node, messageId: 'hardcoded' });
    };
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (text) check(node, text);
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || !TEXT_ATTRIBUTES.has(node.name.name)) return;
        const v = node.value;
        if (!v) return;
        if (v.type === 'Literal' && typeof v.value === 'string') return check(v, v.value);
        if (v.type === 'JSXExpressionContainer') {
          for (const { node: n, text } of literalsIn(v.expression)) check(n, text);
        }
      },
      // {'text'}, {cond ? 'a' : 'b'}, {`${n} days`} as a child
      'JSXElement > JSXExpressionContainer, JSXFragment > JSXExpressionContainer'(node) {
        for (const { node: n, text } of literalsIn(node.expression)) check(n, text);
      },
    };
  },
};

const SKIP_PARENT_CALLEE = /^(console|Error|TypeError|RangeError|SyntaxError)$/;

function calleeName(call) {
  const c = call.callee;
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && c.object.type === 'Identifier') return c.object.name;
  return '';
}

const noEnglishLiterals = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { english: 'English text in code: use t() from src/i18n (or add "// i18n-ignore: <reason>" if it is not for people to read).' },
  },
  create(context) {
    if (isExcluded(relPath(context))) return {};
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    // Rule no-hardcoded-text owns whatever is reached from a JSX attribute value or a JSX child
    // through nothing but ?:, ||, && and +. Do not report the same literal twice.
    const ownedByJsxRule = node => {
      let n = node;
      if (n.type === 'TemplateElement') n = n.parent;
      for (;;) {
        const p = n.parent;
        if (!p) return false;
        if (p.type === 'JSXExpressionContainer' || p.type === 'JSXAttribute') return true;
        const through =
          (p.type === 'ConditionalExpression' && p.test !== n) ||
          p.type === 'LogicalExpression' ||
          (p.type === 'BinaryExpression' && p.operator === '+') ||
          p.type === 'TSAsExpression' || p.type === 'TSNonNullExpression' || p.type === 'TSSatisfiesExpression';
        if (!through) return false;
        n = p;
      }
    };

    const skipContext = node => {
      const p = node.parent;
      if (!p) return true;
      switch (p.type) {
        case 'ImportDeclaration':
        case 'ExportAllDeclaration':
        case 'ExportNamedDeclaration':
        case 'ImportExpression':
        case 'TSLiteralType':
        case 'TSEnumMember':
        case 'TSImportType':
        case 'TSExternalModuleReference':
        case 'SwitchCase':
        case 'ExpressionStatement': // directives
        case 'ThrowStatement':
        case 'TaggedTemplateExpression':
          return true;
        case 'Property':
        case 'PropertyDefinition':
        case 'MethodDefinition':
          return p.key === node;
        case 'BinaryExpression':
          return ['==', '===', '!=', '!=='].includes(p.operator) || ownedByJsxRule(node);
        case 'NewExpression':
        case 'CallExpression':
          return SKIP_PARENT_CALLEE.test(calleeName(p)) || p.callee === node;
        default:
          return ownedByJsxRule(node);
      }
    };

    // A string handed to console.*, an Error constructor or a throw is for developers.
    const insideDevOnly = node => {
      for (let n = node.parent; n; n = n.parent) {
        if ((n.type === 'CallExpression' || n.type === 'NewExpression') && SKIP_PARENT_CALLEE.test(calleeName(n))) return true;
        if (n.type === 'ThrowStatement') return true;
      }
      return false;
    };

    const keyOf = node => {
      const p = node.parent;
      if (p && p.type === 'Property' && p.value === node) {
        return p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : '';
      }
      return '';
    };

    const check = (node, text) => {
      if (!hasEnglishWord(text)) return;
      let copy = looksLikeEnglishCopy(text);
      if (!copy) {
        const key = keyOf(node);
        const t = text.replace(KEEP, '').trim();
        copy = COPY_KEYS.has(key) && /^[A-Z][a-z]{2,}/.test(t);
      }
      if (!copy) return;
      if (hasIgnoreComment(sourceCode, node)) return;
      context.report({ node, messageId: 'english' });
    };

    return {
      Literal(node) {
        if (typeof node.value !== 'string' || skipContext(node) || insideDevOnly(node)) return;
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (skipContext(node) || insideDevOnly(node)) return;
        const text = node.quasis.map(q => q.value.cooked ?? q.value.raw).join('{}');
        check(node, text);
      },
    };
  },
};

export const rules = {
  'no-hardcoded-text': noHardcodedText,
  'no-english-literals': noEnglishLiterals,
};

export default { rules };
