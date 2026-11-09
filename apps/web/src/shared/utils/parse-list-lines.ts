export type ListKind = 'todo' | 'bullet' | 'number';
export type ListLine = { indent: number; kind: ListKind | 'text'; checked: boolean; text: string };

const MARKER = /^([-*+•]|\d+[.)])\s+/;
const CHECKBOX = /^\[([ xX]?)\]\s*/;

function parseLine(line: string): ListLine {
  const indent = (line.match(/^\s*/)?.[0] ?? '').replaceAll('\t', '    ').length;
  const trimmed = line.trim();
  const marker = trimmed.match(MARKER);
  const body = marker ? trimmed.slice(marker[0].length) : trimmed;
  const checkbox = body.match(CHECKBOX);
  const text = (checkbox ? body.slice(checkbox[0].length) : body).trim();
  const listKind = marker && /\d/.test(marker[1]) ? 'number' : 'bullet';
  return {
    indent,
    kind: checkbox ? 'todo' : marker ? listKind : 'text',
    checked: /x/i.test(checkbox?.[1] ?? ''),
    text,
  };
}

export const parseListLines = (text: string): ListLine[] =>
  text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((line) => line.text);
