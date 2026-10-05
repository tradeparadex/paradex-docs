import {useWindowSize} from '@docusaurus/theme-common';

/**
 * The window size by Fern's breakpoint: the desktop layout (header tabs and
 * links, sidebar) starts at 1024px, where Docusaurus' starts at 997px. The CSS
 * switches at the same width (max-width: 1023px / min-width: 1024px).
 */
export function useFernWindowSize(): ReturnType<typeof useWindowSize> {
  return useWindowSize({desktopBreakpoint: 1023});
}
