#!/usr/bin/env node
/**
 * Scaffolds a new Fern changelog entry under fern/pages/release-notes/prod/.
 *
 * Usage:
 *   node scripts/new-release-note.js <version> --tags UI,API [--date MM-DD-YYYY]
 *
 * If an entry already exists for the resolved date (multiple releases can
 * land the same day), the new version is prepended as another `##` card in
 * that file rather than overwriting it - Fern renders each top-level `##`
 * heading in a dated file as its own timeline card, newest first.
 */
const fs = require('fs');
const path = require('path');

const ALLOWED_TAGS = ['UI', 'API', 'Bug Fix', 'Docs'];
const PROD_DIR = path.resolve(__dirname, '..', 'fern', 'pages', 'release-notes', 'prod');

function usage() {
  console.log(`Usage: node scripts/new-release-note.js <version> --tags UI,API [--date MM-DD-YYYY]

  <version>   Release version, e.g. 1.153.0 or v1.153.0
  --tags      Comma-separated tags (canonical: ${ALLOWED_TAGS.join(', ')})
  --date      Override the entry date (default: today), format MM-DD-YYYY
`);
}

function parseArgs(argv) {
  const args = { tags: [], date: null, version: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--tags') {
      args.tags = (argv[++i] || '').split(',').map((t) => t.trim()).filter(Boolean);
    } else if (arg === '--date') {
      args.date = argv[++i];
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  args.version = positional[0] || null;
  return args;
}

function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${d.getFullYear()}`;
}

function renderEntry(version, tags) {
  const tagList = tags.map((t) => `"${t}"`).join(', ');
  const lines = [`## ${version}`, '', `<ChangelogTags tags={[${tagList}]} />`, ''];
  // Always a flat bullet list, even with multiple tags: the timeline
  // layout's condensed excerpt renders blank when a `####` heading is the
  // first thing after <ChangelogTags/>. Multi-tag bullets get a bold inline
  // prefix instead, so the individual permalink page still shows which tag
  // each line belongs to.
  if (tags.length > 1) {
    for (const tag of tags) {
      lines.push(`* **${tag}:** <!-- fill in -->`);
    }
  } else {
    lines.push('* <!-- fill in -->');
  }
  lines.push('');
  return lines.join('\n').replace(/\n+$/, '\n') + '\n';
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    usage();
    process.exit(1);
  }

  if (!args.version) {
    usage();
    process.exit(1);
  }
  if (args.tags.length === 0) {
    console.error('Error: --tags is required, e.g. --tags UI,API');
    process.exit(1);
  }

  const unknown = args.tags.filter((t) => !ALLOWED_TAGS.includes(t));
  if (unknown.length > 0) {
    console.warn(
      `Warning: non-canonical tag(s) ${unknown.map((t) => `"${t}"`).join(', ')} - canonical tags are ${ALLOWED_TAGS.join(', ')}. Proceeding anyway.`
    );
  }

  const version = args.version.startsWith('v') ? args.version : `v${args.version}`;

  const dateStr = args.date || formatDate(new Date());
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    console.error(`Error: --date must be in MM-DD-YYYY format, got "${dateStr}"`);
    process.exit(1);
  }

  fs.mkdirSync(PROD_DIR, { recursive: true });
  const filePath = path.join(PROD_DIR, `${dateStr}.mdx`);
  const entry = renderEntry(version, args.tags);

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, entry + existing.replace(/^\n+/, ''));
    console.log(`Prepended ${version} to ${path.relative(process.cwd(), filePath)}`);
  } else {
    fs.writeFileSync(filePath, entry);
    console.log(`Created ${path.relative(process.cwd(), filePath)}`);
  }
}

main();
