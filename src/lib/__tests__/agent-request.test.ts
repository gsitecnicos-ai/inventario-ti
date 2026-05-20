import { parseJsonRequest } from '../agent-request';

describe('agent-request utilities', () => {
  describe('parseJsonRequest', () => {
    it('should parse plain JSON request', async () => {
      const data = { test: 'value', number: 42 };
      const body = JSON.stringify(data);
      const request = new Request('http://localhost', {
        method: 'POST',
        body: body,
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseJsonRequest<typeof data>(request);
      expect(result).toEqual(data);
      expect(result.test).toBe('value');
      expect(result.number).toBe(42);
    });

    it('should parse empty JSON object', async () => {
      const request = new Request('http://localhost', {
        method: 'POST',
        body: '{}',
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseJsonRequest<Record<string, unknown>>(request);
      expect(result).toEqual({});
    });

    it('should parse JSON arrays', async () => {
      const data = [1, 2, 3, 4, 5];
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseJsonRequest<number[]>(request);
      expect(result).toEqual(data);
      expect(result.length).toBe(5);
    });

    it('should throw on invalid JSON', async () => {
      const request = new Request('http://localhost', {
        method: 'POST',
        body: 'invalid json {]',
        headers: {
          'content-type': 'application/json',
        },
      });

      await expect(parseJsonRequest(request)).rejects.toThrow();
    });

    it('should parse request with missing content-encoding header', async () => {
      const data = { key: 'value' };
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseJsonRequest<typeof data>(request);
      expect(result).toEqual(data);
    });
  });
});
