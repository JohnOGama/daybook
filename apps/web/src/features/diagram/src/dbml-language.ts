import { StreamLanguage } from '@codemirror/language';

type State = { depth: number; settings: boolean; word: number; afterKeyword: boolean };

const KEYWORD = /^(Table|Ref|Enum|Project|TableGroup|Note|indexes|as)\b/;

// Enough DBML to colour it: keywords, table names, column types, [settings], strings and comments.
export const dbmlLanguage = StreamLanguage.define<State>({
  name: 'dbml',
  startState: () => ({ depth: 0, settings: false, word: 0, afterKeyword: false }),
  token(stream, state) {
    if (stream.sol()) state.word = 0;
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^'''/)) {
      stream.skipTo("'''") ? stream.match("'''") : stream.skipToEnd();
      return 'string';
    }
    if (stream.match(/^'(?:[^'\\]|\\.)*'?/) || stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^`[^`]*`?/)) return 'string';
    const next = stream.peek();
    if (next === '[' || next === ']') {
      stream.next();
      state.settings = next === '[';
      return 'bracket';
    }
    if (state.settings) {
      if (stream.match(/^[^\],:'"`]+/)) return 'meta';
      stream.next();
      return 'meta';
    }
    if (next === '{' || next === '}') {
      stream.next();
      state.depth = Math.max(0, state.depth + (next === '{' ? 1 : -1));
      return 'brace';
    }
    if (stream.match(/^(<>|[<>-])/)) return 'operator';
    if (state.depth === 0 && stream.match(KEYWORD)) {
      state.afterKeyword = true;
      return 'keyword';
    }
    if (stream.match(/^[\w.]+/)) {
      state.word += 1;
      if (state.afterKeyword) {
        state.afterKeyword = false;
        return 'className';
      }
      return state.depth > 0 && state.word === 2 ? 'typeName' : 'variableName';
    }
    stream.next();
    return null;
  },
});
