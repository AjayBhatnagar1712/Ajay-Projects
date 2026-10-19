'use client';

import katex from 'katex';

type MathTextProps = {
  text: string | number | null | undefined;
  className?: string;
};

const LATEX_COMMANDS = [
  'sqrt',
  'frac',
  'div',
  'mu',
  'pi',
  'theta',
  'alpha',
  'beta',
  'gamma',
  'Delta',
  'circ',
  'infty',
  'neq',
  'approx',
  'le',
  'ge',
  'times',
  'pm',
  'angle',
  'int',
  'sum',
  'prod',
  'in',
  'cup',
  'cap',
  'perp',
  'parallel',
  'to',
  'therefore',
  'cdot',
  'left',
  'right',
  'text',
];

const LATEX_COMMAND_SET = new Set(LATEX_COMMANDS);

const LATEX_SYMBOL_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /[\u00B5\u03BC]/g, replacement: '\\mu' },
  { pattern: /\u03C0/g, replacement: '\\pi' },
  { pattern: /\u03B8/g, replacement: '\\theta' },
  { pattern: /\u03B1/g, replacement: '\\alpha' },
  { pattern: /\u03B2/g, replacement: '\\beta' },
  { pattern: /\u03B3/g, replacement: '\\gamma' },
  { pattern: /\u0394/g, replacement: '\\Delta' },
  { pattern: /\u221E/g, replacement: '\\infty' },
  { pattern: /\u2260/g, replacement: '\\neq' },
  { pattern: /\u2248/g, replacement: '\\approx' },
  { pattern: /\u2264/g, replacement: '\\le' },
  { pattern: /\u2265/g, replacement: '\\ge' },
  { pattern: /\u00D7/g, replacement: '\\times' },
  { pattern: /\u00F7/g, replacement: '\\div' },
  { pattern: /\u00B1/g, replacement: '\\pm' },
  { pattern: /\u2220/g, replacement: '\\angle' },
  { pattern: /\u222B/g, replacement: '\\int' },
  { pattern: /\u2211/g, replacement: '\\sum' },
  { pattern: /\u220F/g, replacement: '\\prod' },
  { pattern: /\u2208/g, replacement: '\\in' },
  { pattern: /\u222A/g, replacement: '\\cup' },
  { pattern: /\u2229/g, replacement: '\\cap' },
  { pattern: /\u22A5/g, replacement: '\\perp' },
  { pattern: /\u2225/g, replacement: '\\parallel' },
  { pattern: /\u2192/g, replacement: '\\to' },
  { pattern: /\u2234/g, replacement: '\\therefore' },
];

const INLINE_SYMBOL_BASE_CHARS = new Set([
  '\u00B5',
  '\u03BC',
  '\u03C0',
  '\u03B8',
  '\u03B1',
  '\u03B2',
  '\u03B3',
  '\u0394',
  '\u221E',
]);

const isWhitespace = (char: string): boolean => /\s/.test(char);
const isAsciiLetter = (char: string): boolean => /[A-Za-z]/.test(char);
const isAsciiLetterOrDigit = (char: string): boolean => /[A-Za-z0-9]/.test(char);
const isVariableBaseChar = (char: string): boolean =>
  isAsciiLetterOrDigit(char) || INLINE_SYMBOL_BASE_CHARS.has(char);

const readCommandEnd = (value: string, start: number): number | null => {
  if (value[start] !== '\\') return null;
  let cursor = start + 1;
  while (cursor < value.length && isAsciiLetter(value[cursor])) cursor += 1;
  if (cursor === start + 1) return null;
  return cursor;
};

const readBalancedGroupEnd = (value: string, start: number): number | null => {
  if (value[start] !== '{') return null;
  let depth = 0;
  for (let cursor = start; cursor < value.length; cursor += 1) {
    const char = value[cursor];
    if (char === '\\') {
      cursor += 1;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return cursor + 1;
      if (depth < 0) return null;
    }
  }
  return null;
};

const readSupOrSubEnd = (value: string, start: number): number | null => {
  if (start >= value.length || (value[start] !== '^' && value[start] !== '_')) return null;

  let cursor = start + 1;
  while (cursor < value.length && isWhitespace(value[cursor])) cursor += 1;
  if (cursor >= value.length) return null;

  if (value[cursor] === '{') return readBalancedGroupEnd(value, cursor);
  if (value[cursor] === '\\') return readCommandEnd(value, cursor);
  return cursor + 1;
};

const sanitizeLatexInput = (value: string): string => {
  if (!value) return value;
  // Some OCR/edit flows persist braces as \{...\}; for this app we normalize those to real groups.
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\\([{}])/g, '$1');
};

const normalizeLatex = (value: string): string => {
  let next = sanitizeLatexInput(value).replace(
    /([0-9A-Za-z\u00B5\u03BC\u03C0\u03B8\u03B1\u03B2\u03B3\u0394\u221E])\u00B0/g,
    '$1^\\circ'
  );
  next = next.replace(/\u00B0/g, '\\circ');

  for (const { pattern, replacement } of LATEX_SYMBOL_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  for (const cmd of LATEX_COMMANDS) {
    const pattern = new RegExp(`(^|[^\\\\a-zA-Z])(${cmd})(?=\\s*[\\{\\(\\^_]|\\b)`, 'g');
    next = next.replace(pattern, `$1\\\\${cmd}`);
  }

  return next;
};

const extractInlineLatexSegments = (value: string): Array<{ kind: 'text' | 'math'; value: string }> => {
  const source = sanitizeLatexInput(value);
  const segments: Array<{ kind: 'text' | 'math'; value: string }> = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === '\\') {
      const commandEnd = readCommandEnd(source, cursor);
      if (commandEnd != null) {
        const commandName = source.slice(cursor + 1, commandEnd);
        let mathEnd = commandEnd;
        let hasAttachments = false;

        while (mathEnd < source.length) {
          let scan = mathEnd;
          while (scan < source.length && isWhitespace(source[scan])) scan += 1;

          if (scan < source.length && source[scan] === '{') {
            const groupEnd = readBalancedGroupEnd(source, scan);
            if (groupEnd == null) break;
            hasAttachments = true;
            mathEnd = groupEnd;
            continue;
          }

          const supOrSubEnd = readSupOrSubEnd(source, scan);
          if (supOrSubEnd != null) {
            hasAttachments = true;
            mathEnd = supOrSubEnd;
            continue;
          }

          break;
        }

        if (LATEX_COMMAND_SET.has(commandName) || hasAttachments) {
          if (cursor > textStart) {
            segments.push({ kind: 'text', value: source.slice(textStart, cursor) });
          }
          segments.push({ kind: 'math', value: normalizeLatex(source.slice(cursor, mathEnd)) });
          cursor = mathEnd;
          textStart = cursor;
          continue;
        }
      }
    }

    if (isVariableBaseChar(char)) {
      let baseEnd = cursor + 1;
      while (baseEnd < source.length && isVariableBaseChar(source[baseEnd])) baseEnd += 1;

      let mathEnd = baseEnd;
      let hasSupOrSub = false;
      while (mathEnd < source.length) {
        const supOrSubEnd = readSupOrSubEnd(source, mathEnd);
        if (supOrSubEnd == null) break;
        hasSupOrSub = true;
        mathEnd = supOrSubEnd;
      }

      if (hasSupOrSub) {
        if (cursor > textStart) {
          segments.push({ kind: 'text', value: source.slice(textStart, cursor) });
        }
        segments.push({ kind: 'math', value: normalizeLatex(source.slice(cursor, mathEnd)) });
        cursor = mathEnd;
        textStart = cursor;
        continue;
      }
    }

    cursor += 1;
  }

  if (textStart < source.length) {
    segments.push({ kind: 'text', value: source.slice(textStart) });
  }

  return segments;
};

const renderMathOrRaw = (expr: string, key: string) => {
  try {
    const html = katex.renderToString(expr, { throwOnError: true, displayMode: false });
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return (
      <span key={key} className="text-destructive">
        {expr}
      </span>
    );
  }
};

export default function MathText({ text, className }: MathTextProps) {
  const raw = text == null ? '' : String(text);
  const source = raw.trim();
  if (!source) return <span className={className}>{raw}</span>;

  const parts = source.split(/(\$[^$]+\$)/g).filter(Boolean);

  return (
    <span className={`math-preview whitespace-pre-wrap break-words ${className || ''}`}>
      {parts.map((part, index) => {
        const isMathBlock = part.startsWith('$') && part.endsWith('$') && part.length > 2;
        if (isMathBlock) {
          const expr = normalizeLatex(part.slice(1, -1));
          return renderMathOrRaw(expr, `math-block-${index}`);
        }

        const segments = extractInlineLatexSegments(part);
        return (
          <span key={`mixed-${index}`}>
            {segments.map((segment, segmentIndex) => {
              if (segment.kind === 'text') {
                return <span key={`text-${index}-${segmentIndex}`}>{segment.value}</span>;
              }

              return (
                <span key={`math-inline-${index}-${segmentIndex}`} className="mx-1 inline-block align-middle">
                  {renderMathOrRaw(segment.value, `math-render-${index}-${segmentIndex}`)}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
