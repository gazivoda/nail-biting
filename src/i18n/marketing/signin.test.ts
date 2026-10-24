import { describe, it, expect } from 'vitest';
import { messages as home } from '../scopes/marketing-home';
import { formatMessage } from '../message';
import { anySignIn, comboKey, composeSignInAnswer, methodKeys, methodsText, relayWho, signInCombos } from './signin';
import { signInAnswer } from '../../../shared/flagCopy.js';

// How English writes "Google, Apple or an emailed link" (shared/flagCopy.js joinOr: no comma before "or")
const englishMethods = (isOn: (flag: string) => boolean) => {
  const names = methodKeys(isOn).map(k => ({ google: 'Google', apple: 'Apple', microsoft: 'Microsoft', magic: 'an emailed link' }[k]));
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
};

describe('the sign-in answer for the other languages', () => {
  it('has eight combinations, each with its own key', () => {
    const keys = signInCombos().map(c => c.key);
    expect(new Set(keys).size).toBe(8);
    expect(keys).toContain('');
    expect(keys).toContain('apple+microsoft+magic');
  });

  it('its pieces, in English, compose exactly what shared/flagCopy.js writes for English, for every combination', () => {
    for (const { isOn } of signInCombos()) {
      if (!anySignIn(isOn)) continue;   // only composed when another method is on
      const say = (key: Parameters<Parameters<typeof composeSignInAnswer>[0]>[0], params?: Record<string, string | number>) =>
        formatMessage(home[key], { methods: englishMethods(isOn), ...params }, 'en');
      expect(composeSignInAnswer(say, isOn), comboKey(isOn)).toBe(signInAnswer(isOn));
    }
  });

  it('names Apple, Microsoft or both in the second sentence', () => {
    expect(relayWho(() => false)).toBeNull();
    expect(relayWho(f => f === 'signin_apple')).toBe('apple');
    expect(relayWho(f => f === 'signin_microsoft')).toBe('microsoft');
    expect(relayWho(f => f !== 'signin_magic_link')).toBe('both');
  });

  it('writes the methods as a list in the language', () => {
    const names = { google: 'Google', apple: 'Apple', microsoft: 'Microsoft', magic: 'einem Link per E-Mail' };
    expect(methodsText('de', names, () => false)).toBe('Google');
    expect(methodsText('de', names, f => f === 'signin_apple' || f === 'signin_magic_link')).toBe('Google, Apple oder einem Link per E-Mail');
    expect(methodsText('es', { ...names, magic: 'un enlace enviado por correo' }, f => f === 'signin_microsoft')).toBe('Google o Microsoft');
  });
});
