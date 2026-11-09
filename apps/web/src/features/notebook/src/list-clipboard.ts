import type { Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Extension, type JSONContent } from '@tiptap/react';
import { type ListKind, parseListLines } from '@/shared/utils/parse-list-lines';

const LIST_NODES: Record<ListKind, { list: string; item: string }> = {
  todo: { list: 'taskList', item: 'taskItem' },
  bullet: { list: 'bulletList', item: 'listItem' },
  number: { list: 'orderedList', item: 'listItem' },
};

const LIST_TYPES = new Set(Object.values(LIST_NODES).map(({ list }) => list));
const INDENT = '    ';

type OpenList = { indent: number; kind: ListKind; node: JSONContent; siblings: JSONContent[] };

export function listBlocksFromText(text: string): JSONContent[] | null {
  const lines = parseListLines(text);
  if (lines.length < 2 || lines.every(({ kind }) => kind === 'text')) return null;

  const blocks: JSONContent[] = [];
  let open: OpenList[] = [];

  for (const { indent, kind, checked, text: lineText } of lines) {
    const paragraph: JSONContent = { type: 'paragraph', content: [{ type: 'text', text: lineText }] };
    if (kind === 'text') {
      blocks.push(paragraph);
      open = [];
      continue;
    }

    while ((open.at(-1)?.indent ?? -1) > indent) open.pop();
    const top = open.at(-1);
    let list = top;
    if (!top || top.indent !== indent || top.kind !== kind) {
      const sameLevel = top?.indent === indent;
      if (sameLevel) open.pop();
      const siblings = sameLevel ? top.siblings : top ? (top.node.content?.at(-1)?.content ?? blocks) : blocks;
      const node: JSONContent = { type: LIST_NODES[kind].list, content: [] };
      siblings.push(node);
      list = { indent, kind, node, siblings };
      open.push(list);
    }

    list?.node.content?.push({
      type: LIST_NODES[kind].item,
      ...(kind === 'todo' ? { attrs: { checked } } : {}),
      content: [paragraph],
    });
  }
  return blocks;
}

const isList = (node: ProseMirrorNode) => LIST_TYPES.has(node.type.name);

function itemMarker(list: ProseMirrorNode, item: ProseMirrorNode, index: number) {
  if (list.type.name === 'taskList') return `- [${item.attrs.checked ? 'x' : ' '}]`;
  if (list.type.name === 'orderedList') return `${(list.attrs.start ?? 1) + index}.`;
  return '-';
}

function linesOf(node: ProseMirrorNode, depth = 0): string[] {
  const pad = INDENT.repeat(depth);
  if (!isList(node)) return [`${pad}${node.textContent}`];

  const lines: string[] = [];
  node.forEach((item, _itemOffset, itemIndex) => {
    item.forEach((child, _childOffset, childIndex) => {
      if (childIndex === 0 && !isList(child)) lines.push(`${pad}${itemMarker(node, item, itemIndex)} ${child.textContent}`);
      else lines.push(...linesOf(child, depth + 1));
    });
  });
  return lines;
}

export function listTextFromSlice(slice: Slice): string {
  const nodes: ProseMirrorNode[] = [];
  slice.content.forEach((node) => nodes.push(node));
  return nodes.some(isList) ? nodes.flatMap((node) => linesOf(node)).join('\n') : '';
}

export const ListClipboard = Extension.create({
  name: 'listClipboard',

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        props: {
          clipboardTextSerializer: listTextFromSlice,
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            // A copy from another page already carries its real structure and formatting.
            if (!data || data.getData('text/html').includes('data-pm-slice') || editor.isActive('codeBlock')) return false;
            const blocks = listBlocksFromText(data.getData('text/plain'));
            if (!blocks) return false;
            editor.chain().focus().insertContent(blocks).run();
            return true;
          },
        },
      }),
    ];
  },
});
