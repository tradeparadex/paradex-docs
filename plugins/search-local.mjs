// The site search: @easyops-cn/docusaurus-search-local, with the text of each
// <Tab> indexed under that tab's anchor (#config-file) instead of under the
// heading above the tabs. A hit on text in a tab then opens that tab, the way
// a link to the tab does (src/components/fern/Tabs.tsx); before, it landed on
// the section with the first tab shown and the matched text hidden.
//
// The plugin starts a section only at h1-h3 and has no option for this, so
// this wraps its document parser (dist/server/server/utils/parseDocument.js)
// and its document scan (scanDocuments.js), which it calls through the
// modules' exports.

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const PACKAGE = '@easyops-cn/docusaurus-search-local';
const plugin = require(PACKAGE);
const parser = require(`${PACKAGE}/dist/server/server/utils/parseDocument.js`);
const scanner = require(`${PACKAGE}/dist/server/server/utils/scanDocuments.js`);
const {getCondensedText} = require(`${PACKAGE}/dist/server/server/utils/getCondensedText.js`);

// Where the plugin starts a section.
const HEADINGS = 'h1, h2, h3';

// The tab sections ("title\n#hash"). Their title shows in a hit's path, but
// they are not headings to search for: the plugin's heading records for them
// are dropped.
const tabSections = new Set();

/**
 * The heading whose section holds `el` in the plugin's split, where a heading
 * runs to the next heading beside it: the nearest heading before `el` among
 * its own and its ancestors' siblings.
 */
function headingAbove($, el) {
  for (let $el = $(el); $el.length && !$el.is('article'); $el = $el.parent()) {
    const $heading = $el.prevAll(HEADINGS).first();
    if ($heading.length) return $heading.contents().not('a.hash-link').text().trim();
  }
  return '';
}

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
    const $bar = $tabs.children('.fern-tabs__bar');
    const anchor = $bar.children('.fern-tabs__anchor').eq(index).attr('id');
    // Shown as the hit's section: the heading the tabs are under, then the tab.
    const title = [headingAbove($, $tabs), $bar.find('[role=tab]').eq(index).text().trim()].filter(Boolean).join(' › ');
    // The panel's own text: not that of tabs nested in it (sections of their
    // own) or what follows a heading in it (that heading's section).
    const $own = $(panel).clone();
    $own.find('.fern-tabs').remove();
    $own.find(HEADINGS).each((_, heading) => {
      $(heading).nextUntil(HEADINGS).remove();
      $(heading).remove();
    });
    return {anchor, title, content: getCondensedText($own.contents().get(), $)};
  });

  // Headings inside panels keep their sections from the whole page; every
  // other section is read again with the panels emptied.
  const inPanel = $('article').find(HEADINGS).toArray().map((heading) => $(heading).closest('.fern-tabs__panel').length > 0);
  const whole = parseDocument($);
  $(panels).empty();
  const outside = parseDocument($).sections;
  const sections = whole.sections.map((section, i) => (inPanel[i] ? section : outside.shift()));

  for (const {anchor, title, content} of tabs) {
    if (!anchor || !content) continue;
    sections.push({title: title || whole.pageTitle, hash: `#${anchor}`, content});
    tabSections.add(`${title}\n#${anchor}`);
  }
  return {...whole, sections};
}

export default function searchLocalPlugin(context, options) {
  const original = parser.parseDocument.original ?? parser.parseDocument;
  parser.parseDocument = Object.assign(($) => parseDocumentWithTabs(original, $), {original});
  const scan = scanner.scanDocuments.original ?? scanner.scanDocuments;
  scanner.scanDocuments = Object.assign(
    async (...args) => {
      // [titles, headings, descriptions, keywords, contents]
      const [titles, headings, ...rest] = await scan(...args);
      return [titles, headings.filter((doc) => !tabSections.has(`${doc.t}\n${doc.h}`)), ...rest];
    },
    {original: scan},
  );
  return plugin.default(context, options);
}

export const validateOptions = plugin.validateOptions;
