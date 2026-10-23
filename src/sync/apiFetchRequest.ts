// The browser's HttpRequest: the app's own `apiFetch` (session cookie on the web,
// bearer token in the Electron wrapper), a 30 second timeout so one stuck request
// can never freeze the single-flight engine, and the HTTP status recovered from
// the error `apiFetch` throws for a non-2xx answer.

import { apiFetch } from '../contexts/AuthContext';
import type { HttpRequest } from './api';

const TIMEOUT_MS = 30_000;

export const apiFetchRequest: HttpRequest = async (method, path, body) => {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const json: unknown = await apiFetch(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl?.signal,
    });
    return { status: 200, body: json };
  } catch (e) {
    const m = /API error (\d+)/.exec(e instanceof Error ? e.message : '');
    return { status: m ? Number(m[1]) : 0, body: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
};
