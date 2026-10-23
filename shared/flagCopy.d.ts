// Types for flagCopy.js. Keep the two files in step: shared/flagCopy.test.js imports every name below.

export type IsOn = (flag: string) => boolean;

export const COPY_FLAGS: readonly string[];

export interface CopyRule {
  id: string;
  where: string;
  off: string;
  flags: readonly string[];
  on: (isOn: IsOn) => string | null | undefined;
}
export const RULES: readonly CopyRule[];

export function signInAnswer(isOn: IsOn): string;
export function resolveMarkers(text: string, isOn: IsOn): string;
export function flagAware(text: string, isOn: IsOn): string;
export function mentionsFlagCopy(text: unknown): boolean;
export function anyRuleActive(isOn: IsOn): boolean;
export function flagAwareDeep<T>(value: T, isOn: IsOn): T;
export function dropEmptySections<T extends { sections?: { heading?: string; body?: string; html?: string }[] }>(page: T): T;
export function fillCopyTokens(text: string, values: Record<string, string>): string;
export function fillCopyTokensDeep<T>(value: T, values: Record<string, string>): T;
