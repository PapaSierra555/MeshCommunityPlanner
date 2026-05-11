import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/utils/html';

describe('escapeHtml', () => {
  it('escapes characters that can create HTML markup or attributes', () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')"> & text`))
      .toBe('&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; text');
  });

  it('handles nullish values as empty strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
