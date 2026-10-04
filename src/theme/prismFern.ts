// Prism theme matching the Shiki "material-theme-darker" colors Fern used for
// code blocks (Fern lightened comments to #8A8A8A). Token types that Prism
// does not produce on its own ('command', 'argument', 'key-N', ...) come from
// src/components/code/refine.ts.

import type {PrismTheme} from 'prism-react-renderer';

const FG = '#EEFFFF';
const COMMENT = '#8A8A8A';
const STRING = '#C3E88D';
const PUNCTUATION = '#89DDFF';
const NUMBER = '#F78C6C';
const FUNCTION = '#82AAFF';
const STORAGE = '#C792EA';
const TYPE = '#FFCB6B';
const RED = '#F07178';
const PINK = '#FF9CAC';

const theme: PrismTheme = {
  plain: {color: FG, backgroundColor: '#16191C'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata', 'shebang'], style: {color: COMMENT, fontStyle: 'italic'}},
    {types: ['punctuation', 'operator', 'keyword', 'null', 'nil', 'regex', 'selector'], style: {color: PUNCTUATION}},
    {types: ['keyword-control'], style: {color: PUNCTUATION, fontStyle: 'italic'}},
    {types: ['storage', 'string-prefix', 'attr-name'], style: {color: STORAGE}},
    {types: ['keyword-other', 'number', 'placeholder'], style: {color: NUMBER}},
    {types: ['string', 'char', 'attr-value', 'inserted', 'url', 'argument'], style: {color: STRING}},
    {types: ['boolean'], style: {color: PINK}},
    {types: ['function', 'builtin', 'method', 'function-variable'], style: {color: FUNCTION}},
    {types: ['class-name', 'command', 'namespace', 'annotation', 'decorator', 'macro'], style: {color: TYPE}},
    {types: ['property', 'tag', 'deleted', 'member'], style: {color: RED}},
    {types: ['variable', 'constant', 'escape', 'parameter', 'symbol', 'entity'], style: {color: FG}},
    {types: ['parameter'], style: {fontStyle: 'italic'}},
    {types: ['important', 'bold'], style: {fontWeight: 'bold'}},
    {types: ['italic'], style: {fontStyle: 'italic'}},

    // JSON: keys cycle through material's per-depth colors; literals are
    // constant.language (punctuation blue).
    {types: ['key-1', 'key-8'], style: {color: STORAGE}},
    {types: ['key-2'], style: {color: TYPE}},
    {types: ['key-3'], style: {color: NUMBER}},
    {types: ['key-4'], style: {color: RED}},
    {types: ['key-5'], style: {color: '#916B53'}},
    {types: ['key-6'], style: {color: FUNCTION}},
    {types: ['key-7'], style: {color: PINK}},
    {types: ['key-9'], style: {color: STRING}},
    {types: ['boolean', 'null', 'keyword'], languages: ['json', 'python', 'go'], style: {color: PUNCTUATION}},

    {types: ['key', 'property'], languages: ['toml'], style: {color: FG}},
    {types: ['namespace'], languages: ['csharp', 'php'], style: {color: FG}},
    {types: ['class-name'], languages: ['java'], style: {color: STORAGE}},

    // Strings keep their quote punctuation blue; escapes stay plain.
    {types: ['escape'], style: {color: FG}},
  ],
};

export default theme;
