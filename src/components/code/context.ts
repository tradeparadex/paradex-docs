import {createContext, useContext} from 'react';

/**
 * Set by a tabbed code group (Fern `<CodeBlocks>`) around each of its panels.
 * A code block inside a group drops its own card chrome and toolbar, and
 * reports its code so the group's toolbar can copy or report it.
 */
export type CodeGroupPanel = {register: (code: string, language: string) => void};

export const CodeGroupContext = createContext<CodeGroupPanel | null>(null);

export function useCodeGroupPanel(): CodeGroupPanel | null {
  return useContext(CodeGroupContext);
}
