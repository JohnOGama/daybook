'use client';

import { syntaxHighlighting } from '@codemirror/language';
import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorState, Prec, type Range, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { dbmlLanguage } from './dbml-language';
import type { Problem } from './diagram-types';

export type LineRange = { from: number; to: number };

type DbmlEditorProps = { ytext: Y.Text; awareness: Awareness; problems: Problem[]; fresh: LineRange[]; scrollTo: string | null; readOnly?: boolean };

const editable = new Compartment();
const editability = (readOnly: boolean) => [EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)];

const setFresh = StateEffect.define<LineRange[]>();
const freshLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFresh)) {
        const marks: Range<Decoration>[] = [];
        for (const { from, to } of effect.value) {
          for (let line = Math.max(1, from); line <= Math.min(to, transaction.state.doc.lines); line++) {
            marks.push(Decoration.line({ class: 'cm-fresh-line' }).range(transaction.state.doc.line(line).from));
          }
        }
        return Decoration.set(marks, true);
      }
    }
    return lines.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'transparent', color: 'var(--foreground)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.65' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#4a4a4a' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgb(255 255 255 / 0.03)' },
    '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(255 255 255 / 0.14) !important' },
    '.cm-fresh-line': { backgroundColor: 'rgb(217 165 20 / 0.08)', boxShadow: 'inset 2px 0 0 var(--signal)' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--destructive)', textUnderlineOffset: '3px' },
    '.cm-tooltip': { backgroundColor: 'var(--popover)', border: '1px solid rgb(255 255 255 / 0.1)', borderRadius: '8px' },
    '.tok-keyword': { color: '#c792ea' },
    '.tok-className': { color: 'var(--foreground)', fontWeight: '600' },
    '.tok-typeName': { color: '#8ab4f8' },
    '.tok-meta': { color: 'var(--signal)' },
    '.tok-string': { color: '#a3c99c' },
    '.tok-comment': { color: '#6b6b6b' },
    '.tok-operator': { color: 'var(--muted-foreground)' },
  },
  { dark: true },
);

const tableLine = (name: string) => new RegExp(`^\\s*Table\\s+"?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?(\\s|\\{|$)`);

// CodeMirror bound to the shared DBML text: typing goes into the Yjs document, other people's edits and cursors come out of it.
export function DbmlEditorComponent({ ytext, awareness, problems, fresh, scrollTo, readOnly = false }: DbmlEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const startsReadOnly = useRef(readOnly);

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current as HTMLDivElement,
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          // Ctrl+Z undoes only your own typing, not other people's.
          Prec.high(keymap.of(yUndoManagerKeymap)),
          dbmlLanguage,
          syntaxHighlighting(classHighlighter),
          freshLines,
          theme,
          EditorView.contentAttributes.of({ 'aria-label': 'DBML' }),
          editable.of(editability(startsReadOnly.current)),
          yCollab(ytext, awareness, { undoManager: new Y.UndoManager(ytext) }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
  }, [ytext, awareness]);

  // A role change while open (made view-only, or given edit) applies without rebuilding the editor.
  useEffect(() => {
    view.current?.dispatch({ effects: editable.reconfigure(editability(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const { doc } = editor.state;
    const diagnostics: Diagnostic[] = problems.map(({ line, message }) => {
      const at = doc.line(Math.min(Math.max(line, 1), doc.lines));
      return { from: at.from, to: Math.max(at.to, at.from), severity: 'error', message };
    });
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [problems]);

  useEffect(() => {
    view.current?.dispatch({ effects: setFresh.of(fresh) });
  }, [fresh]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !scrollTo) return;
    const pattern = tableLine(scrollTo);
    for (let number = 1; number <= editor.state.doc.lines; number++) {
      const line = editor.state.doc.line(number);
      if (pattern.test(line.text)) {
        editor.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }) });
        return;
      }
    }
  }, [scrollTo]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
