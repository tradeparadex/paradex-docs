#!/usr/bin/env python3
"""
Script to create a new release page and update all references.
Usage: python create_release_page.py <version>
Example: python create_release_page.py v1.114
"""

import os
import sys
import re
from pathlib import Path
from datetime import datetime

def get_release_template(version):
    """Get the template content for a new release page."""
    return f"""---
title: {version}
---

## Prod
### {version}.0 - {datetime.now().strftime('%b %d')}
🖥️  UI Updates 
* [Add your UI updates here]

⚙️ API Updates
* [Add your API updates here]

🔧 Bug Fixes
* [Add your bug fixes here]

## Testnet
### {version}.0-rc.1 - {datetime.now().strftime('%b %d')}
🖥️  UI Updates 
* [Add your UI updates here]

⚙️ API Updates
* [Add your API updates here]

🔧 Bug Fixes
* [Add your bug fixes here]
"""

def create_release_file(version):
    """Create the release file."""
    release_file_path = Path(__file__).parent.parent / "fern" / "pages" / "release-notes" / f"{version}.md"
    
    if release_file_path.exists():
        print(f"Error: Release file {release_file_path} already exists")
        return False
    
    content = get_release_template(version)
    
    with open(release_file_path, 'w') as f:
        f.write(content)
    
    print(f"Successfully created release file: {release_file_path}")
    return True

def update_overview_mdx(version):
    """Update overview.mdx to include the new release."""
    overview_path = Path(__file__).parent.parent / "fern" / "pages" / "release-notes" / "overview.mdx"
    
    if not overview_path.exists():
        print(f"Error: overview.mdx not found at {overview_path}")
        return False
    
    with open(overview_path, 'r') as f:
        content = f.read()
    
    # Convert version to URL format (v1.114 -> v-1-114)
    url_version = version.replace('.', '-')
    
    # Create new card entry
    new_card = f"""<Card
  title="{version}"
  href="/release-notes/{url_version}"
>
</Card>"""
    
    # Find the CardGroup and add the new card at the beginning
    cardgroup_pattern = r'(<CardGroup cols=\{2\}>)(.*?)(</CardGroup>)'
    
    def replace_cardgroup(match):
        cardgroup_start = match.group(1)
        existing_cards = match.group(2)
        cardgroup_end = match.group(3)
        
        # Add new card at the beginning
        updated_cards = "\n" + new_card + existing_cards
        return cardgroup_start + updated_cards + cardgroup_end
    
    new_content = re.sub(cardgroup_pattern, replace_cardgroup, content, flags=re.DOTALL)
    
    if new_content == content:
        print("Warning: Could not find CardGroup in overview.mdx")
        return False
    
    with open(overview_path, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully updated overview.mdx with {version}")
    return True

def update_archive_mdx(version):
    """Update archive.mdx to include the new release."""
    archive_path = Path(__file__).parent.parent / "fern" / "pages" / "release-notes" / "archive.mdx"
    
    if not archive_path.exists():
        print(f"Error: archive.mdx not found at {archive_path}")
        return False
    
    with open(archive_path, 'r') as f:
        content = f.read()
    
    # Convert version to URL format (v1.114 -> v-1-114)
    url_version = version.replace('.', '-')
    
    # Create new card entry
    new_card = f"""<Card
  title="{version}"
  href="/release-notes/{url_version}"
>
</Card>"""
    
    # Find the CardGroup and add the new card at the beginning
    cardgroup_pattern = r'(<CardGroup cols=\{3\}>)(.*?)(</CardGroup>)'
    
    def replace_cardgroup(match):
        cardgroup_start = match.group(1)
        existing_cards = match.group(2)
        cardgroup_end = match.group(3)
        
        # Add new card at the beginning
        updated_cards = "\n" + new_card + existing_cards
        return cardgroup_start + updated_cards + cardgroup_end
    
    new_content = re.sub(cardgroup_pattern, replace_cardgroup, content, flags=re.DOTALL)
    
    if new_content == content:
        print("Warning: Could not find CardGroup in archive.mdx")
        return False
    
    with open(archive_path, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully updated archive.mdx with {version}")
    return True

def update_docs_yml(version):
    """Update docs.yml to include the new release."""
    docs_yml_path = Path(__file__).parent.parent / "fern" / "docs.yml"
    
    if not docs_yml_path.exists():
        print(f"Error: docs.yml not found at {docs_yml_path}")
        return False
    
    with open(docs_yml_path, 'r') as f:
        content = f.read()
    
    # Convert version to URL format (v1.114 -> v-1-114)
    url_version = version.replace('.', '-')
    
    # Create new page entry
    new_page_entry = f"""              - page: {version}
                path: ./pages/release-notes/{version}.md"""
    
    # Find the release notes section and add the new page
    # Look for the pattern where we need to add the new page
    release_notes_pattern = r'(          - page: v1\.\d+\s+path: \./pages/release-notes/v1\.\d+\.md)'
    
    def replace_release_notes(match):
        existing_entry = match.group(1)
        return new_page_entry + "\n" + existing_entry
    
    new_content = re.sub(release_notes_pattern, replace_release_notes, content)
    
    if new_content == content:
        print("Warning: Could not find release notes section in docs.yml")
        return False
    
    with open(docs_yml_path, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully updated docs.yml with {version}")
    return True

def main():
    if len(sys.argv) != 2:
        print("Usage: python create_release_page.py <version>")
        print("Example: python create_release_page.py v1.114")
        sys.exit(1)
    
    version = sys.argv[1]
    
    # Validate version format
    if not re.match(r'^v\d+\.\d+$', version):
        print("Error: Version must be in format 'v1.114'")
        sys.exit(1)
    
    print(f"Creating release page for {version}...")
    
    # Create the release file
    if not create_release_file(version):
        sys.exit(1)
    
    # Update overview.mdx
    if not update_overview_mdx(version):
        print("Warning: Could not update overview.mdx")
    
    # Update archive.mdx
    if not update_archive_mdx(version):
        print("Warning: Could not update archive.mdx")
    
    # Update docs.yml
    if not update_docs_yml(version):
        print("Warning: Could not update docs.yml")
    
    print(f"\nRelease page {version} created successfully!")
    print("Please review and update the content in the generated file.")

if __name__ == "__main__":
    main()
