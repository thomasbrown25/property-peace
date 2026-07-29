import { describe, expect, it } from 'vitest';
import messages from './en.json';

describe('English navigation messages', () => {
  it.each(['Leasing', 'Financials', 'Operations'])('defines the %s navigation label', (messageId) => {
    expect(messages[messageId]).toBe(messageId);
  });
});
