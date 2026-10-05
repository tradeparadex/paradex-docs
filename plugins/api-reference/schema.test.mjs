import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {markdownToHtml, sanitizeHtml} from './schema.mjs';

describe('spec descriptions are sanitized', () => {
  test('event handlers are dropped from allowed elements', () => {
    assert.equal(markdownToHtml('Logo <img src="logo.png" alt="Logo" onerror="alert(1)">'), '<p>Logo <img src="logo.png" alt="Logo"></p>');
    assert.equal(sanitizeHtml('<img/src=x/onerror=alert(1)>'), '<img src="x/onerror=alert(1)">');
    assert.equal(sanitizeHtml('<img/src="x"/onerror=alert(1)>'), '<img src="x">');
    assert.equal(sanitizeHtml('<div ONMOUSEOVER=\'alert(1)\' title="t">x</div>'), '<div title="t">x</div>');
  });

  test('script URLs are dropped, also when encoded', () => {
    for (const href of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java&#x09;script:alert(1)',
      'jav&#97;script:alert(1)',
      'javascript&colon;alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ]) {
      assert.equal(sanitizeHtml(`<a href="${href}">x</a>`), '<a>x</a>', href);
    }
    assert.equal(sanitizeHtml('<a href=javascript:alert(1)>x</a>'), '<a>x</a>');
    assert.equal(sanitizeHtml('<img srcset="a.png 1x, javascript:alert(1) 2x">'), '<img>');
  });

  test('elements outside the allowed set are escaped', () => {
    assert.equal(sanitizeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(sanitizeHtml('<svg onload=alert(1)>'), '&lt;svg onload=alert(1)&gt;');
    assert.equal(sanitizeHtml('<iframe srcdoc="<script>alert(1)</script>">'), '&lt;iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"&gt;');
  });

  test('attribute values keep no raw tag characters', () => {
    // The page splits description HTML at <pre><code>; one hidden in an
    // attribute must not become markup.
    const html = sanitizeHtml('<img alt="x>y<pre><code>c</code></pre><img src=x onerror=alert(1)>">');
    assert.equal(html, '<img alt="x&gt;y&lt;pre&gt;&lt;code&gt;c&lt;/code&gt;&lt;/pre&gt;&lt;img src=x onerror=alert(1)&gt;">');
    assert.doesNotMatch(html.slice(1), /<(?!\/?img\b)/);
  });

  test('ordinary descriptions are unchanged', () => {
    const html = '<p>See <a href="https://docs.paradex.trade/api#x">the docs</a> and <code>GET /markets</code>.</p>\n<details><summary>More</summary><br />Text</details>';
    assert.equal(sanitizeHtml(html), html);
    assert.equal(markdownToHtml('Use [markets](/api/prod/markets/get-markets) and `<T>`.'), '<p>Use <a href="/api/prod/markets/get-markets">markets</a> and <code>&lt;T&gt;</code>.</p>');
  });
});

describe('spec descriptions render like MDX', () => {
  test('tables sit in the scrolling table card', () => {
    assert.equal(
      markdownToHtml('| Value | Meaning |\n|---|---|\n| `GTC` | Good till cancelled |'),
      '<div class="fern-table"><table>\n<thead>\n<tr>\n<th>Value</th>\n<th>Meaning</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td><code>GTC</code></td>\n<td>Good till cancelled</td>\n</tr>\n</tbody>\n</table></div>',
    );
    assert.equal(markdownToHtml('A <table><tr><td>x</td></tr></table> and `<table>`'), '<p>A <div class="fern-table"><table><tr><td>x</td></tr></table></div> and <code>&lt;table&gt;</code></p>');
  });

  test('stray table tags add no unmatched div', () => {
    assert.equal(markdownToHtml('x </table> y'), '<p>x </table> y</p>');
    assert.equal(markdownToHtml('<table><tr><td>a</td></tr>'), '<table><tr><td>a</td></tr>');
  });
});
