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

/**
 * The language a code block was written with, as is (undefined on a bare
 * fence), set by CodeBlock/Content/String. Docusaurus resolves both a bare
 * fence and ```text to 'text'; code feedback reports them apart, as Fern does.
 */
export const FenceLanguageContext = createContext<string | undefined>(undefined);

export function useFenceLanguage(): string | undefined {
  return useContext(FenceLanguageContext);
}
