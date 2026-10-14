import { describe, expect, it } from 'vitest';
import { parseJobMessage } from './parseJobMessage.js';

describe('parseJobMessage', () => {
  it('parses a valid job message', () => {
    const body = JSON.stringify({ jobType: 'send-notification', payload: { userId: '123' } });

    expect(parseJobMessage(body)).toEqual({
      jobType: 'send-notification',
      payload: { userId: '123' },
    });
  });

  it('rejects a message missing jobType', () => {
    const body = JSON.stringify({ payload: {} });

    expect(() => parseJobMessage(body)).toThrow(/jobType/);
  });

  it('rejects a message with a non-object payload', () => {
    const body = JSON.stringify({ jobType: 'send-notification', payload: 'not-an-object' });

    expect(() => parseJobMessage(body)).toThrow(/payload/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseJobMessage('{not json')).toThrow();
  });
});
