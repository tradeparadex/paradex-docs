# Navigation Restructuring

## Context
When restructuring navigation tabs in `fern/docs.yml`, several things need updating beyond just the tab definitions and navigation tree:

1. **Internal links** — All `.mdx` files under `fern/pages/` and `fern/snippets/` may contain hardcoded links (both `href="..."` and markdown `(...)` style) that reference tab-level URL slugs. When a tab is removed or merged into another, these links must be updated to reflect the new path.

2. **Redirects** — The `redirects:` section at the bottom of `docs.yml` contains mappings from old URLs to current ones. When tabs move, update existing redirect destinations and add new redirects from the old tab paths to the new ones.

3. **Absolute URLs** — Some pages use full `https://docs.paradex.trade/...` URLs. Search for these as well when updating paths.

## Example
Moving `/risk/...` into `/trading/risk/...`:
- Update all `href="/risk/..."` → `href="/trading/risk/..."`
- Update all `(/risk/...)` → `(/trading/risk/...)`
- Add redirect: `/risk/:slug*` → `/trading/risk/:slug*`
- Update existing redirects that had `/risk/...` as a destination
