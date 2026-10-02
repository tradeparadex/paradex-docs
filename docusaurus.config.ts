import path from 'node:path';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import remarkSmartypants from 'remark-smartypants';
import rehypeKatex from 'rehype-katex';

import {loadSite} from './plugins/site.mjs';
import prismFern from './src/theme/prismFern';
import {remarkDropLeadingTitle, remarkFernJsx, remarkTocSkipNested, remarkTrimHeadingIds} from './plugins/fern-mdx.mjs';
import {remarkMermaidStatic} from './plugins/mermaid.mjs';

const SITE_URL = 'https://docs.paradex.trade';
const REPO_URL = 'https://github.com/tradeparadex/paradex-docs';

// Fern typeset prose with smart quotes (’ “ ”); heading ids are unaffected.
const beforeDefaultRemarkPlugins = [remarkTrimHeadingIds, remarkSmartypants, remarkMermaidStatic];
const remarkPlugins = [remarkFernJsx, remarkMath, remarkTocSkipNested, remarkDropLeadingTitle];
const rehypePlugins = [rehypeKatex];

export default async function createConfig(): Promise<Config> {
  // Reads docs/navigation.yml, generates the API reference pages and computes
  // every page URL, sidebar, header tab and redirect. See plugins/site.mjs.
  const site = await loadSite({siteDir: __dirname});

  return {
    title: 'Paradex | Documentation',
    titleDelimiter: '|',
    tagline: 'Paradex documentation',
    favicon: 'assets/logo.png',
    url: SITE_URL,
    baseUrl: '/',
    trailingSlash: false,
    organizationName: 'tradeparadex',
    projectName: 'paradex-docs',

    onBrokenLinks: 'throw',
    onBrokenAnchors: 'warn',
    onDuplicateRoutes: 'throw',

    future: {
      faster: true,
      v4: {
        removeLegacyPostBuildHeadAttribute: true,
        useCssCascadeLayers: false,
      },
    },

    i18n: {defaultLocale: 'en', locales: ['en']},

    staticDirectories: ['static'],

    markdown: {
      format: 'mdx',
      preprocessor: site.preprocess,
      parseFrontMatter: site.parseFrontMatter,
      hooks: {onBrokenMarkdownLinks: 'throw', onBrokenMarkdownImages: 'throw'},
    },

    presets: [
      [
        'classic',
        {
          docs: {
            path: site.pagesDir,
            routeBasePath: '/',
            sidebarPath: site.sidebarsPath,
            include: site.docInclude,
            exclude: [],
            editUrl: ({docPath}) =>
              docPath.startsWith('generated/')
                ? undefined
                : `${REPO_URL}/edit/main/docs/pages/${docPath}`,
            beforeDefaultRemarkPlugins,
            remarkPlugins,
            rehypePlugins,
            breadcrumbs: true,
          },
          blog: {
            path: site.changelog.dir,
            routeBasePath: site.changelog.url.slice(1),
            include: ['*.{md,mdx}'],
            exclude: ['overview.mdx'],
            blogTitle: 'Changelog',
            blogDescription: site.changelog.description,
            postsPerPage: 10,
            blogSidebarCount: 0,
            showReadingTime: false,
            onInlineAuthors: 'ignore',
            onUntruncatedBlogPosts: 'ignore',
            onInlineTags: 'ignore',
            tags: false,
            feedOptions: {
              type: ['rss', 'atom', 'json'],
              title: 'Paradex Release Notes',
              description: site.changelog.description,
              limit: 50,
              copyright: `Copyright © ${new Date().getFullYear()} Paradex`,
            },
            editUrl: ({blogPath}) =>
              `${REPO_URL}/edit/main/docs/release-notes/prod/${blogPath}`,
            beforeDefaultRemarkPlugins,
            remarkPlugins,
            rehypePlugins,
          },
          pages: {
            beforeDefaultRemarkPlugins,
            remarkPlugins,
            rehypePlugins,
          },
          theme: {
            customCss: [
              './src/css/custom.css',
              './src/css/components.css',
              './src/css/api.css',
              './src/css/explorer.css',
              './src/css/landing.css',
              './src/css/content-utilities.css',
              './src/css/code.css',
            ],
          },
          sitemap: {
            lastmod: null,
            changefreq: null,
            priority: null,
            ignorePatterns: ['/releases/changelog/page/**'],
          },
        } satisfies Preset.Options,
      ],
    ],

    plugins: [
      [
        '@easyops-cn/docusaurus-search-local',
        {
          hashed: true,
          language: ['en'],
          indexDocs: true,
          indexBlog: true,
          indexPages: false,
          docsRouteBasePath: '/',
          blogRouteBasePath: site.changelog.url,
          docsDir: site.pagesDir,
          blogDir: site.changelog.dir,
          searchResultLimits: 10,
          searchResultContextMaxLength: 60,
          explicitSearchResultPath: true,
          searchBarShortcutKeymap: '/',
          searchBarShortcutHint: true,
          searchBarPosition: 'left',
          highlightSearchTermsOnTargetPage: false,
        },
      ],
      [path.resolve(__dirname, 'plugins/site-plugin.mjs'), {site}],
    ],

    clientModules: [
      './src/clientModules/katex.ts',
      './src/clientModules/consent.ts',
      './src/clientModules/homePage.ts',
      './src/clientModules/tvlLimit.ts',
      './src/clientModules/sidebarScroll.ts',
    ],

    themeConfig: {
      image: 'assets/logo.png',
      metadata: [{name: 'theme-color', content: '#090a0a'}],
      // The site is dark only, as it was on Fern.
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      docs: {
        sidebar: {hideable: false, autoCollapseCategories: false},
      },
      navbar: {
        hideOnScroll: false,
        logo: {
          alt: 'Paradex Docs',
          src: 'assets/logo-light.svg',
          srcDark: 'assets/logo-dark.svg',
          href: SITE_URL,
          target: '_self',
          height: 15,
        },
        items: [
          ...site.tabs.map((tab) => ({
            to: tab.href,
            label: tab.label,
            position: 'left' as const,
            className: 'navbar-tab',
            activeBaseRegex: `^/${tab.slug}(/|$)`,
          })),
          ...site.navbarLinks.map((link) => ({
            href: link.url,
            label: link.text,
            position: 'right' as const,
            className: link.type === 'filled' ? 'navbar-cta' : 'navbar-link-minimal',
            target: '_self',
          })),
        ],
      },
      // Fern listed every heading level in "On this page".
      tableOfContents: {minHeadingLevel: 2, maxHeadingLevel: 6},
      prism: {
        // Fern's Shiki colors (material-theme-darker); the site is dark only.
        theme: prismFern,
        darkTheme: prismFern,
        additionalLanguages: [
          'bash',
          'json',
          'python',
          'go',
          'rust',
          'java',
          'toml',
          'yaml',
          'docker',
          'diff',
          'powershell',
          'solidity',
          'csharp',
          'php',
          'ruby',
          'swift',
        ],
      },
    } satisfies Preset.ThemeConfig,
  };
}
