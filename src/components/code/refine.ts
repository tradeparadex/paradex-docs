// Token post-processing that brings Prism's output close to the Shiki
// highlighting Fern used (material-theme-darker). Prism groups some scopes
// differently, so this file re-tokenizes bash and adjusts a few token types
// for the other languages. The colors live in src/theme/prismFern.ts.
//
// Kept free of React and of relative imports so the comparison script can
// load it in Node with type stripping.

export type Token = {types: string[]; content: string; empty?: boolean};

const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  curl: 'bash',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  yml: 'yaml',
  txt: 'text',
  plaintext: 'text',
  plain: 'text',
  jsonc: 'json',
  json5: 'json',
  golang: 'go',
  rs: 'rust',
  cs: 'csharp',
  'c#': 'csharp',
  rb: 'ruby',
  sol: 'solidity',
  dockerfile: 'docker',
};

export function normalizeLanguage(language: string | undefined): string {
  const lang = (language ?? 'text').toLowerCase();
  return ALIASES[lang] ?? lang;
}

/** Fern shows no gutter on plain text blocks. */
export function isPlainText(language: string): boolean {
  return language === 'text' || language === '';
}

export function isShell(language: string): boolean {
  return language === 'bash';
}

/**
 * Fern's CLI gutter (same rules as Fern's code block): `$` on the first line
 * of each command, `>` on lines that continue one, i.e. after a line ending
 * in `\` or while a quote or bracket opened earlier is still open.
 */
export function cliPrefixes(code: string): string[] {
  const lines = code.split('\n');
  const prefixes: string[] = [];
  let single = false;
  let double = false;
  let backtick = false;
  const brackets: string[] = [];
  lines.forEach((line, i) => {
    if (i === 0) prefixes.push('$');
    else {
      const continued = lines[i - 1].trimEnd().endsWith('\\');
      const open = brackets.length > 0 || single || double || backtick;
      prefixes.push(continued || open ? '>' : '$');
    }
    for (let k = 0; k < line.length; k++) {
      const ch = line[k];
      if (k > 0 && line[k - 1] === '\\') continue;
      if (ch === "'" && !double && !backtick) single = !single;
      else if (ch === '"' && !single && !backtick) double = !double;
      else if (ch === '`' && !single && !double) backtick = !backtick;
      else if (!single && !double && !backtick) {
        if (ch === '{' || ch === '[' || ch === '(') brackets.push(ch);
        else if (ch === '}' || ch === ']' || ch === ')') {
          const opener = ch === '}' ? '{' : ch === ']' ? '[' : '(';
          if (brackets[brackets.length - 1] === opener) brackets.pop();
        }
      }
    }
  });
  return prefixes;
}

/** Languages Fern gives the `$` prompt gutter (before alias normalization). */
export function hasCliGutter(language: string | undefined): boolean {
  return ['bash', 'shell', 'cli'].includes((language ?? '').toLowerCase());
}

// ---------------------------------------------------------------------------
// Bash: Shiki colors the first word of each command as a command name and the
// rest as arguments. Prism only knows a fixed list of commands, so bash is
// tokenized here instead.

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done',
  'case', 'esac', 'in', 'function', 'select', 'time',
]);
const BASH_RESET_KEYWORDS = new Set(['then', 'else', 'elif', 'do', 'if', 'while', 'until', 'time']);
const BASH_BUILTINS = new Set([
  'cd', 'echo', 'export', 'source', 'alias', 'unalias', 'unset', 'set', 'exit',
  'return', 'read', 'eval', 'exec', 'printf', 'test', 'shift', 'trap', 'wait',
  'ulimit', 'umask', 'local', 'declare', 'readonly', 'typeset', 'type', 'hash',
  'pwd', 'pushd', 'popd', 'dirs', 'let', 'getopts', 'command', 'builtin',
  'enable', 'help', 'logout', 'mapfile', 'shopt', 'true', 'false', 'bg', 'fg',
  'jobs', 'disown', 'suspend', 'times', 'caller', 'complete', 'compgen',
]);

function tokenizeBash(code: string): Token[][] {
  const lines: Token[][] = [[]];
  let line = lines[0];
  const push = (content: string, ...types: string[]) => {
    if (!content) return;
    const parts = content.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        line = [];
        lines.push(line);
      }
      if (part) line.push({types: types.length ? types : ['plain'], content: part});
    });
  };

  const n = code.length;
  let i = 0;
  let commandPos = true; // the next word names a command
  let continued = false; // this line continues a `\` line
  let atLineStart = true;
  let heredoc: string | null = null;
  let pendingHeredoc: string | null = null;
  const subshells: number[] = [];

  // Reads a word starting at i; returns [end, hasQuotes].
  const wordEnd = (from: number): number => {
    let j = from;
    while (j < n) {
      const c = code[j];
      if (/[\s|&;<>()]/.test(c)) break;
      if (c === '\\' && j + 1 < n) {
        if (code[j + 1] === '\n') break;
        j += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        const close = code.indexOf(c, j + 1);
        let k = close;
        if (c === '"') {
          k = j + 1;
          while (k < n && code[k] !== '"') k += code[k] === '\\' ? 2 : 1;
        }
        j = k < 0 || k >= n ? n : k + 1;
        continue;
      }
      if (c === '$' && code[j + 1] === '(') break;
      j++;
    }
    return j;
  };

  // Emits a word with quotes, escapes and variables split out.
  const emitWord = (word: string, base: string[]) => {
    let k = 0;
    let buf = '';
    const flush = () => {
      push(buf, ...base);
      buf = '';
    };
    while (k < word.length) {
      const c = word[k];
      if (c === "'") {
        flush();
        const close = word.indexOf("'", k + 1);
        const end = close < 0 ? word.length : close;
        push("'", 'string', 'punctuation');
        push(word.slice(k + 1, end), 'string');
        if (close >= 0) push("'", 'string', 'punctuation');
        k = end + 1;
        continue;
      }
      if (c === '"') {
        flush();
        push('"', 'string', 'punctuation');
        let m = k + 1;
        let s = '';
        while (m < word.length && word[m] !== '"') {
          if (word[m] === '\\' && m + 1 < word.length) {
            push(s, 'string');
            s = '';
            push(word.slice(m, m + 2), 'string', 'escape');
            m += 2;
            continue;
          }
          const v = /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9#?@*$!-])/.exec(word.slice(m));
          if (v) {
            push(s, 'string');
            s = '';
            push('$', 'string', 'variable', 'punctuation');
            push(v[0].slice(1), 'string', 'variable');
            m += v[0].length;
            continue;
          }
          s += word[m];
          m++;
        }
        push(s, 'string');
        if (m < word.length) push('"', 'string', 'punctuation');
        k = m + 1;
        continue;
      }
      if (c === '\\' && k + 1 < word.length) {
        flush();
        push(word.slice(k, k + 2), 'escape');
        k += 2;
        continue;
      }
      const v = /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9#?@*$!-])/.exec(word.slice(k));
      if (v) {
        flush();
        push('$', 'variable', 'punctuation');
        push(v[0].slice(1), 'variable');
        k += v[0].length;
        continue;
      }
      buf += c;
      k++;
    }
    flush();
  };

  while (i < n) {
    const c = code[i];

    if (heredoc !== null) {
      const eol = code.indexOf('\n', i);
      const end = eol < 0 ? n : eol;
      const text = code.slice(i, end);
      push(text, text.trim() === heredoc ? 'keyword' : 'string');
      if (text.trim() === heredoc) heredoc = null;
      if (eol >= 0) push('\n');
      i = end + 1;
      atLineStart = true;
      commandPos = true;
      continue;
    }

    if (c === '\n') {
      push('\n');
      i++;
      atLineStart = true;
      if (pendingHeredoc !== null) {
        heredoc = pendingHeredoc;
        pendingHeredoc = null;
      }
      if (!continued) commandPos = true;
      continue;
    }
    if (/[ \t]/.test(c)) {
      let j = i;
      while (j < n && /[ \t]/.test(code[j])) j++;
      push(code.slice(i, j));
      i = j;
      continue;
    }
    const lineStartNoIndent = atLineStart && (i === 0 || code[i - 1] === '\n');
    const wasContinued = continued && atLineStart;
    atLineStart = false;
    continued = false;

    // Line continuation.
    if (c === '\\' && code[i + 1] === '\n') {
      push('\\');
      continued = true;
      i++;
      continue;
    }
    // Comments start a word.
    if (c === '#') {
      const eol = code.indexOf('\n', i);
      const end = eol < 0 ? n : eol;
      push(code.slice(i, end), 'comment');
      i = end;
      continue;
    }
    // Command substitution.
    if (c === '$' && code[i + 1] === '(') {
      push('$(', 'punctuation');
      subshells.push(1);
      commandPos = true;
      i += 2;
      continue;
    }
    if (c === ')' && subshells.length) {
      subshells.pop();
      push(')', 'punctuation');
      commandPos = false;
      i++;
      continue;
    }
    // Heredoc start.
    const hd = /^<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(code.slice(i));
    if (hd) {
      push(hd[0], 'operator');
      pendingHeredoc = hd[2];
      i += hd[0].length;
      continue;
    }
    // Control operators start a new command; redirections do not.
    const op = /^(\|\||&&|;;|[|;&]|[0-9]*>>?&?[0-9-]*|&>>?|<<<|<|[(){}])/.exec(code.slice(i));
    if (op) {
      push(op[0], 'operator');
      if (/^(\|\||&&|;;|[|;&(){}])$/.test(op[0])) commandPos = true;
      i += op[0].length;
      continue;
    }

    const end = wordEnd(i);
    const word = code.slice(i, Math.max(end, i + 1));
    i = Math.max(end, i + 1);

    if (wasContinued && lineStartNoIndent) {
      // Shiki leaves the first word of an unindented continuation line plain.
      emitWord(word, ['plain']);
      continue;
    }
    if (commandPos) {
      const assign = /^([A-Za-z_][A-Za-z0-9_]*)(\+?=)(.*)$/s.exec(word);
      if (assign) {
        push(assign[1], 'variable');
        push(assign[2], 'operator');
        if (/^[0-9]+$/.test(assign[3])) push(assign[3], 'number');
        else emitWord(assign[3], ['argument']);
        continue;
      }
      if (BASH_KEYWORDS.has(word)) {
        push(word, 'keyword', 'keyword-control');
        commandPos = BASH_RESET_KEYWORDS.has(word);
        continue;
      }
      commandPos = false;
      if (BASH_BUILTINS.has(word)) {
        push(word, 'builtin');
        continue;
      }
      emitWord(word, ['command']);
      continue;
    }
    // Shiki reads `NAME=123` arguments as an assignment with a number.
    const numAssign = /^([^='"]*=)([0-9]+)$/.exec(word);
    if (numAssign) {
      push(numAssign[1], 'argument');
      push(numAssign[2], 'number');
      continue;
    }
    emitWord(word, ['argument']);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Generic helpers for Prism-tokenized languages.

const ESCAPE_RE = /(\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|[\s\S]))/;
const PLACEHOLDER_RE = /(\{[A-Za-z_][\w.]*\})/;

const isStringToken = (t: Token) =>
  (t.types.includes('string') || t.types.includes('string-property') || t.types.includes('single-quoted-string')) &&
  !t.types.includes('interpolation') &&
  !t.types.includes('punctuation');

/**
 * Splits a string token so quotes get punctuation color, Python prefixes
 * storage color, and escapes / Python placeholders their own colors.
 */
function splitString(tok: Token, language: string): Token[] {
  if (tok.empty) return [tok];
  let rest = tok.content;
  const out: Token[] = [];
  let prefix = '';
  let open = '';
  const o = /^([rRbBuUfF]{0,2})("""|'''|"|'|`)/.exec(rest);
  if (o && (!o[1] || language === 'python')) {
    prefix = o[1];
    open = o[2];
    rest = rest.slice(o[0].length);
  }
  let close = '';
  const c = /("""|'''|"|'|`)$/.exec(rest);
  if (c && (!open || c[1] === open) && !/(^|[^\\])(\\\\)*\\$/.test(rest.slice(0, -c[1].length))) {
    close = c[1];
    rest = rest.slice(0, -close.length);
  }
  // Shiki colors the triple quotes of Python f-strings as string text.
  const quoteTypes = /f/i.test(prefix) && open.length === 3 ? tok.types : [...tok.types, 'punctuation'];
  if (prefix) out.push({types: [...tok.types, 'string-prefix'], content: prefix});
  if (open) out.push({types: quoteTypes, content: open});
  const raw = /r/i.test(prefix);
  const placeholders = language === 'python' && !/f/i.test(prefix);
  for (const part of raw ? [rest] : rest.split(ESCAPE_RE)) {
    if (!part) continue;
    if (!raw && part.length >= 2 && part[0] === '\\') {
      out.push({types: [...tok.types, 'escape'], content: part});
      continue;
    }
    if (!placeholders) {
      out.push({types: tok.types, content: part});
      continue;
    }
    for (const piece of part.split(PLACEHOLDER_RE)) {
      if (piece) out.push({types: PLACEHOLDER_RE.test(piece) ? [...tok.types, 'placeholder'] : tok.types, content: piece});
    }
  }
  if (close) out.push({types: language === 'python' && close.length === 3 && tok.types.includes('string-interpolation') ? tok.types : [...tok.types, 'punctuation'], content: close});
  return out;
}

/** Splits plain text into identifier / other runs so calls can be recognised. */
function splitPlain(tok: Token): Token[] {
  if (tok.empty) return [tok];
  const parts = tok.content.split(/([A-Za-z_$][\w$]*)/);
  return parts.filter(Boolean).map((content) => ({types: tok.types, content}));
}

const isIdent = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s);
const isPlain = (t: Token) => t.types.length === 1 && t.types[0] === 'plain';
const nextSolid = (toks: Token[], k: number) => toks.slice(k + 1).find((t) => t.content.trim() !== '');
const prevSolid = (toks: Token[], k: number) => {
  for (let j = k - 1; j >= 0; j--) if (toks[j].content.trim() !== '') return toks[j];
  return undefined;
};

// Per-language keyword classes (Shiki scopes → material colors).
const STORAGE: Record<string, Set<string>> = {
  python: new Set(['def', 'class', 'lambda', 'async', 'global', 'nonlocal']),
  javascript: new Set(['const', 'let', 'var', 'function', 'class', 'async', 'get', 'set', 'static', 'extends']),
  typescript: new Set(['const', 'let', 'var', 'function', 'class', 'async', 'interface', 'type', 'enum', 'namespace', 'declare', 'abstract', 'readonly', 'public', 'private', 'protected', 'static', 'extends', 'implements', 'get', 'set']),
  go: new Set(['string', 'byte', 'int', 'int64', 'int32', 'uint', 'uint64', 'float64', 'float32', 'bool', 'error', 'rune', 'any', 'struct', 'interface', 'chan']),
  java: new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'enum', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'var', 'extends', 'implements', 'synchronized', 'throws']),
  csharp: new Set(['class', 'interface', 'enum', 'struct', 'public', 'private', 'protected', 'internal', 'static', 'readonly', 'async', 'override', 'virtual', 'abstract', 'void', 'string', 'int', 'long', 'bool', 'double', 'decimal', 'object']),
  rust: new Set(['fn', 'let', 'mut', 'struct', 'enum', 'impl', 'trait', 'type', 'pub', 'const', 'static', 'mod', 'async', 'move', 'ref', 'dyn', 'where']),
  php: new Set(['function', 'class', 'public', 'private', 'protected', 'static', 'abstract', 'final', 'const', 'interface', 'trait', 'extends', 'implements']),
  ruby: new Set(['def', 'class', 'module']),
  swift: new Set(['class', 'struct', 'enum', 'protocol', 'extension', 'public', 'private', 'static', 'override']),
  solidity: new Set(['function', 'contract', 'struct', 'enum', 'event', 'modifier', 'mapping', 'public', 'private', 'internal', 'external', 'view', 'pure', 'payable', 'memory', 'storage', 'calldata', 'constant', 'immutable', 'address', 'uint256', 'uint', 'int', 'bool', 'bytes32', 'string', 'bytes']),
};
const CONTROL: Record<string, Set<string>> = {
  python: new Set(['import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while', 'return', 'await', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'break', 'continue', 'pass', 'assert', 'del']),
  javascript: new Set(['import', 'export', 'from', 'as', 'default', 'if', 'else', 'for', 'while', 'do', 'return', 'await', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'yield']),
  typescript: new Set(['import', 'export', 'from', 'as', 'default', 'if', 'else', 'for', 'while', 'do', 'return', 'await', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'yield']),
  go: new Set(['import', 'if', 'else', 'for', 'range', 'return', 'switch', 'case', 'default', 'break', 'continue', 'go', 'defer', 'select', 'goto', 'fallthrough']),
  java: new Set(['if', 'else', 'for', 'while', 'do', 'return', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue']),
  csharp: new Set(['if', 'else', 'for', 'foreach', 'while', 'do', 'return', 'await', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue']),
  rust: new Set(['use', 'if', 'else', 'for', 'while', 'loop', 'match', 'return', 'await', 'break', 'continue', 'in']),
  php: new Set(['require_once', 'require', 'include', 'include_once', 'use', 'namespace', 'if', 'else', 'elseif', 'foreach', 'for', 'while', 'return', 'try', 'catch', 'throw']),
  ruby: new Set(['if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'in', 'return', 'begin', 'rescue', 'ensure', 'end', 'do', 'then', 'yield', 'case', 'when']),
  swift: new Set(['import', 'if', 'else', 'guard', 'for', 'in', 'while', 'return', 'try', 'catch', 'throw', 'switch', 'case', 'do']),
  solidity: new Set(['import', 'pragma', 'if', 'else', 'for', 'while', 'return', 'returns', 'emit', 'require', 'revert']),
};
const OTHER: Record<string, Set<string>> = {
  java: new Set(['import', 'package', 'new']),
  csharp: new Set(['using', 'namespace']),
  ruby: new Set(['require', 'require_relative', 'new', 'include', 'attr_accessor', 'attr_reader']),
  php: new Set(['new']),
  swift: new Set(['let', 'var', 'func']),
};

function classifyKeyword(tok: Token, language: string): Token {
  const word = tok.content.trim();
  if (OTHER[language]?.has(word)) return {...tok, types: [...tok.types, 'keyword-other']};
  if (STORAGE[language]?.has(word)) return {...tok, types: [...tok.types, 'storage']};
  if (CONTROL[language]?.has(word)) return {...tok, types: [...tok.types, 'keyword-control']};
  return tok;
}

/** JSON: nested keys cycle through material's per-depth colors. */
function refineJson(lines: Token[][]): Token[][] {
  let depth = 0;
  return lines.map((line) =>
    line.flatMap((tok) => {
      if (tok.types.includes('punctuation') || tok.types.includes('operator')) {
        for (const ch of tok.content) {
          if (ch === '{') depth++;
          else if (ch === '}') depth = Math.max(0, depth - 1);
        }
        return [tok];
      }
      if (tok.types.includes('property')) {
        const level = ((Math.max(depth, 1) - 1) % 9) + 1;
        return splitString({...tok, types: [...tok.types, `key-${level}`]}, 'json');
      }
      if (isStringToken(tok)) return splitString(tok, 'json');
      return [tok];
    }),
  );
}

/**
 * Python: Shiki colors names inside call arguments as functions, keyword
 * arguments and parameters italic, and attributes inside calls red.
 */
function refinePython(lines: Token[][]): Token[][] {
  const stack: ('call' | 'params' | 'group')[] = [];
  return lines.map((line) => {
    const toks = line.flatMap((t) => (isPlain(t) ? splitPlain(t) : isStringToken(t) ? splitString(t, 'python') : [t]));
    const out: Token[] = [];
    for (let k = 0; k < toks.length; k++) {
      const tok = toks[k];
      const next = nextSolid(toks, k);
      const prev = prevSolid(out, out.length);
      const word = tok.content.trim();
      if (tok.types.includes('interpolation') && tok.types.includes('punctuation')) {
        out.push({...tok, types: [...tok.types, 'placeholder']});
        continue;
      }
      if ((tok.types.includes('punctuation') || tok.types.includes('operator')) && !tok.types.includes('string')) {
        for (const ch of tok.content) {
          if (ch === '(') {
            const callee = prev && (isIdent(prev.content.trim()) || prev.content.trim() === ')') && !prev.types.includes('keyword-control');
            const beforeCallee = prev ? prevSolid(out, out.indexOf(prev)) : undefined;
            stack.push(callee ? (beforeCallee?.content.trim() === 'def' ? 'params' : 'call') : 'group');
          } else if (ch === '[' || ch === '{') stack.push('group');
          else if ((ch === ')' || ch === ']' || ch === '}') && stack.length) stack.pop();
        }
        out.push(tok);
        continue;
      }
      const ctx = stack[stack.length - 1];
      if (tok.types.includes('keyword')) {
        if ((word === 'print' || word === 'exec') && next?.content.trim().startsWith('(')) {
          out.push({...tok, types: ['function']});
        } else {
          out.push(classifyKeyword(tok, 'python'));
        }
        continue;
      }
      if (isPlain(tok) && isIdent(word)) {
        if (ctx === 'params') out.push({...tok, types: ['parameter']});
        else if (next?.content.trim().startsWith('(')) out.push({...tok, types: ['function']});
        else if (ctx === 'call' && next?.content.trim() === '=') out.push({...tok, types: ['parameter']});
        else if (ctx === 'call' && prev?.content.trim() === '.') out.push({...tok, types: ['member']});
        else if (ctx === 'call') out.push({...tok, types: ['function']});
        else out.push(tok);
        continue;
      }
      if ((tok.types.includes('builtin') || tok.types.includes('class-name')) && ctx === 'call') {
        out.push({...tok, types: ['function']});
        continue;
      }
      out.push(tok);
    }
    return out;
  });
}

/** Other languages: quotes, escapes, call names and keyword classes. */
function refineGeneric(lines: Token[][], language: string): Token[][] {
  return lines.map((line) => {
    const toks = line.flatMap((t): Token[] => {
      if (isPlain(t)) return splitPlain(t);
      if (isStringToken(t)) return splitString(t, language);
      // TOML: dotted table names keep plain dots.
      if (language === 'toml' && t.types.includes('table')) {
        return t.content.split(/(\.)/).filter(Boolean).map((content) => ({types: content === '.' ? ['plain'] : t.types, content}));
      }
      return [t];
    });
    const out: Token[] = [];
    toks.forEach((tok, k) => {
      const word = tok.content.trim();
      const next = nextSolid(toks, k);
      const prev = prevSolid(out, out.length);
      if (tok.types.includes('keyword') && tok.types.includes('class-name')) {
        // C# `var` is colored as a type.
        out.push({...tok, types: ['class-name']});
        return;
      }
      if (language === 'php' && tok.types.includes('keyword') && (word === 'echo' || word === 'print')) {
        out.push({...tok, types: ['function']});
        return;
      }
      if (tok.types.includes('keyword')) {
        out.push(classifyKeyword(tok, language));
        return;
      }
      if (language === 'php' && tok.types.includes('variable') && tok.content.startsWith('$')) {
        out.push({...tok, types: [...tok.types, 'punctuation'], content: '$'});
        if (tok.content.length > 1) out.push({...tok, content: tok.content.slice(1)});
        return;
      }
      if (language === 'ruby' && (tok.types.includes('constant') || (isPlain(tok) && /^[A-Z]\w*$/.test(word)))) {
        out.push({...tok, types: ['class-name']});
        return;
      }
      if (tok.types.includes('builtin') && STORAGE[language]?.has(word)) {
        out.push({...tok, types: [...tok.types, 'storage']});
        return;
      }
      if (language === 'java' && tok.types[0] === 'import' && !tok.types.includes('punctuation')) {
        out.push({...tok, types: [...tok.types, 'storage']});
        return;
      }
      if (isPlain(tok) && isIdent(word)) {
        const nextText = next?.content.trim() ?? '';
        if (nextText.startsWith('(')) {
          out.push({...tok, types: ['function']});
          return;
        }
        if (language === 'go' && prev?.content.trim() === 'package') {
          out.push({...tok, types: ['class-name']});
          return;
        }
        if (language === 'ruby' && prev?.content.trim() === '.') {
          out.push({...tok, types: ['function']});
          return;
        }
        if (language === 'swift' && nextText.startsWith(':') && !nextText.startsWith('::')) {
          out.push({...tok, types: ['function']});
          return;
        }
        if (language === 'csharp' && prev?.types.includes('class-name') && nextText.startsWith('=') && !nextText.startsWith('==')) {
          out.push({...tok, types: ['class-name']});
          return;
        }
      }
      out.push(tok);
    });
    return out;
  });
}

const HTTP_METHOD = /^(?:CONNECT|DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT|TRACE)(?=\s)/i;

/**
 * HTTP: Shiki colors a request line's method (keyword.control) and leaves the
 * target plain. Prism has no http grammar loaded, so each line is one plain token.
 */
function refineHttp(lines: Token[][]): Token[][] {
  return lines.map((line) => {
    const [first, ...rest] = line;
    const method = first && isPlain(first) ? HTTP_METHOD.exec(first.content)?.[0] : undefined;
    if (!method) return line;
    return [{types: ['keyword-control'], content: method}, {...first, content: first.content.slice(method.length)}, ...rest];
  });
}

export function refineTokens(lines: Token[][], language: string, code?: string): Token[][] {
  if (isShell(language)) {
    const source = code ?? lines.map((l) => l.map((t) => (t.empty ? '' : t.content)).join('')).join('\n');
    return tokenizeBash(source);
  }
  if (language === 'json') return refineJson(lines);
  if (language === 'http') return refineHttp(lines);
  if (language === 'python') return refinePython(lines);
  if (isPlainText(language)) return lines;
  return refineGeneric(lines, language);
}
