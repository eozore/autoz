import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, generateRequestId } from '../lib/logger';

describe('Structured Logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('logger.info produces valid JSON with timestamp, level, and message', () => {
    logger.info('test');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);

    expect(entry).toMatchObject({
      level: 'info',
      message: 'test',
    });
    expect(entry.timestamp).toBeDefined();
    expect(() => new Date(entry.timestamp).toISOString()).not.toThrow();
  });

  it('logger.error includes meta fields and writes to stderr', () => {
    logger.error('fail', { code: 500 });

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();

    const raw = stderrSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);

    expect(entry).toMatchObject({
      level: 'error',
      message: 'fail',
      code: 500,
    });
    expect(entry.timestamp).toBeDefined();
  });

  it('info logs go to stdout, not stderr', () => {
    logger.info('stdout check');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('warn logs go to stdout', () => {
    logger.warn('warning');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    expect(stderrSpy).not.toHaveBeenCalled();

    const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('warn');
  });

  it('debug logs go to stdout', () => {
    logger.debug('debug msg');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    expect(stderrSpy).not.toHaveBeenCalled();

    const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('debug');
  });

  it('generateRequestId returns a valid UUID', () => {
    const id = generateRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
