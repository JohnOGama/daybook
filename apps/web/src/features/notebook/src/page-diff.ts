import type { JSONContent } from '@tiptap/react';

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

const isInline = (node: JSONContent) => node.text !== undefined || node.type === 'hardBreak';

// One line per paragraph, heading or list item, skipping empty ones.
export function pageLines(content: JSONContent | null | undefined): string[] {
  const linesOf = (node: JSONContent): string[] => {
    const children = node.content ?? [];
    if (children.length === 0 || children.some(isInline)) return [children.map((child) => child.text ?? ' ').join('')];
    return children.flatMap(linesOf);
  };
  return content ? linesOf(content).filter((line) => line.trim()) : [];
}

// ponytail: whole-line diff with an n × m table; go word-level, or to a diff library, if chapters reach thousands of paragraphs
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const common = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      common[i][j] = before[i] === after[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ kind: 'same', text: before[i] });
      i++;
      j++;
    } else if (j >= after.length || (i < before.length && common[i + 1][j] >= common[i][j + 1])) {
      lines.push({ kind: 'removed', text: before[i++] });
    } else {
      lines.push({ kind: 'added', text: after[j++] });
    }
  }
  return lines;
}
