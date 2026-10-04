// The site search: @easyops-cn/docusaurus-search-local, with the text of each
// <Tab> indexed under that tab's anchor (#config-file) instead of under the
// heading above the tabs. A hit on text in a tab then opens that tab, the way
// a link to the tab does (src/components/fern/Tabs.tsx); before, it landed on
// the section with the first tab shown and the matched text hidden.
//
// The plugin starts a section only at h1-h3 and has no option for this, so
// this wraps its document parser (dist/server/server/utils/parseDocument.js,
// which its own parse step calls through the module's exports).

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const PACKAGE = '@easyops-cn/docusaurus-search-local';
const plugin = require(PACKAGE);
const parser = require(`${PACKAGE}/dist/server/server/utils/parseDocument.js`);
const {getCondensedText} = require(`${PACKAGE}/dist/server/server/utils/getCondensedText.js`);

// Where the plugin starts a section.
const HEADINGS = 'h1, h2, h3';

/**
 * The plugin's sections for a page, except that the text of each tab panel
 * is its own section, keyed by the tab's anchor. Text under a heading inside
 * a panel stays in that heading's section (Tabs.tsx opens the tab for it).
 */
function parseDocumentWithTabs(parseDocument, $) {
  const panels = $('article .fern-tabs__panel').toArray();
  if (!panels.length) return parseDocument($);

  const tabs = panels.map((panel) => {
    const $tabs = $(panel).parent();
    const index = $tabs.children('.fern-tabs__panel').index(panel);
    const anchor = $tabs.children('.fern-tabs__bar').children('.fern-tabs__anchor').eq(index).attr('id');
    // The panel's own text: not that of tabs nested in it (sections of their
    // own) or what follows a heading in it (that heading's section).
    const $own = $(panel).clone();
    $own.find('.fern-tabs').remove();
    $own.find(HEADINGS).each((_, heading) => {
      $(heading).nextUntil(HEADINGS).remove();
      $(heading).remove();
    });
    return {anchor, content: getCondensedText($own.contents().get(), $)};
  });

  // Headings inside panels keep their sections from the whole page; every
  // other section is read again with the panels emptied.
  const inPanel = $('article').find(HEADINGS).toArray().map((heading) => $(heading).closest('.fern-tabs__panel').length > 0);
  const whole = parseDocument($);
  $(panels).empty();
  const outside = parseDocument($).sections;
  const sections = whole.sections.map((section, i) => (inPanel[i] ? section : outside.shift()));

  // Titled with the page title, so the plugin adds no heading record for them.
  for (const {anchor, content} of tabs) {
    if (anchor && content) sections.push({title: whole.pageTitle, hash: `#${anchor}`, content});
  }
  return {...whole, sections};
}

export default function searchLocalPlugin(context, options) {
  const original = parser.parseDocument.original ?? parser.parseDocument;
  parser.parseDocument = Object.assign(($) => parseDocumentWithTabs(original, $), {original});
  return plugin.default(context, options);
}

export const validateOptions = plugin.validateOptions;
