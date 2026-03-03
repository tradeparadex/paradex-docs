#!/usr/bin/env python3
"""
Scan fern/pages/release-notes/ for versioned markdown files and update the
"What's new" section in what-is-paradex.mdx with the two latest versions.

Run from the repo root:
    python3 scripts/update-landing-releases.py
"""

import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE_DIR = os.path.join(REPO_ROOT, "fern", "pages", "release-notes")
LANDING_PAGE = os.path.join(REPO_ROOT, "fern", "pages", "what-is-paradex.mdx")

# Match files like v1.135.md
VERSION_RE = re.compile(r"^v1\.(\d+)\.md$")


def get_sorted_versions():
    """Return list of (minor_version_int, filename) sorted descending."""
    versions = []
    for fname in os.listdir(RELEASE_DIR):
        m = VERSION_RE.match(fname)
        if m:
            versions.append((int(m.group(1)), fname))
    versions.sort(key=lambda x: x[0], reverse=True)
    return versions


def version_to_slug(minor: int) -> str:
    """Convert minor version number to URL slug, e.g. 135 -> /releases/v-1-135"""
    return f"/releases/v-1-{minor}"


def version_to_display(minor: int) -> str:
    """Convert minor version number to display name, e.g. 135 -> v1.135"""
    return f"v1.{minor}"


def build_release_cards(versions):
    """Build the MDX snippet for the two latest release cards."""
    cards = []
    for i, (minor, _fname) in enumerate(versions[:2]):
        slug = version_to_slug(minor)
        display = version_to_display(minor)
        badge = ' <span className="lp-release-badge">Latest</span>' if i == 0 else ""
        card = (
            f'        <a className="lp-release-card" href="{slug}">\n'
            f'          <h3 className="lp-release-version">{display}{badge}</h3>\n'
            f"        </a>"
        )
        cards.append(card)
    return "\n".join(cards)


def update_landing_page(new_cards_block):
    """Replace the release grid content in the landing page MDX."""
    with open(LANDING_PAGE, "r") as f:
        content = f.read()

    # Match the release grid div and its contents
    pattern = re.compile(
        r"(<div className=\"lp-release-grid\">)\n.*?\n(\s*</div>)",
        re.DOTALL,
    )

    match = pattern.search(content)
    if not match:
        print("ERROR: Could not find lp-release-grid in landing page")
        return False

    replacement = f"{match.group(1)}\n{new_cards_block}\n{match.group(2)}"
    new_content = content[: match.start()] + replacement + content[match.end() :]

    with open(LANDING_PAGE, "w") as f:
        f.write(new_content)

    return True


def main():
    versions = get_sorted_versions()
    if len(versions) < 2:
        print("ERROR: Need at least 2 release note files")
        return

    latest_two = versions[:2]
    print(f"Latest versions: {version_to_display(latest_two[0][0])}, {version_to_display(latest_two[1][0])}")

    cards_block = build_release_cards(latest_two)
    if update_landing_page(cards_block):
        print("Updated what-is-paradex.mdx with latest release versions")
    else:
        print("Failed to update landing page")


if __name__ == "__main__":
    main()
