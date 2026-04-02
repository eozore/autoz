import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';

// Mock prisma before importing index
vi.mock('../lib/prisma', () => ({
  prisma: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $on: vi.fn(),
  },
}));

// Mock logger to suppress output during tests
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Graceful Shutdown', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let server: Server;
  let newSigtermHandlers: Function[];
  let newSigintHandlers: Function[];

  beforeEach(async () => {
    // Use a random port to avoid EADDRINUSE
    process.env.PORT = '0';

    // Snapshot existing signal listeners before module load
    const existingSigterm = process.listeners('SIGTERM') as Function[];
    const existingSigint = process.listeners('SIGINT') as Function[];

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    const indexModule = await import('../index');
    server = indexModule.server as Server;

    // Identify handlers added by our module
    newSigtermHandlers = (process.listeners('SIGTERM') as Function[]).filter(
      (l) => !existingSigterm.includes(l)
    );
    newSigintHandlers = (process.listeners('SIGINT') as Function[]).filter(
      (l) => !existingSigint.includes(l)
    );
  });

  afterEach(async () => {
    // Remove signal handlers added by our module
    newSigtermHandlers.forEach((l) =>
      process.removeListener('SIGTERM', l as NodeJS.SignalsListener)
    );
    newSigintHandlers.forEach((l) =>
      process.removeListener('SIGINT', l as NodeJS.SignalsListener)
    );

    processExitSpy.mockRestore();
    vi.restoreAllMocks();
    vi.resetModules();

    // Close the real server
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.PORT;
  });

  it('registers SIGTERM and SIGINT handlers and exports server', () => {
    expect(server).toBeDefined();
    expect(typeof server.close).toBe('function');
    expect(newSigtermHandlers.length).toBeGreaterThanOrEqual(1);
    expect(newSigintHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it('SIGTERM handler calls server.close() and prisma.$disconnect()', async () => {
    const { prisma } = await import('../lib/prisma');

    const closeSpy = vi.spyOn(server, 'close').mockImplementation(((cb?: Function) => {
      if (cb) cb();
      return server;
    }) as never);

    // Invoke the SIGTERM handler
    expect(newSigtermHandlers.length).toBeGreaterThanOrEqual(1);
    newSigtermHandlers[0]();

    // Allow microtasks to flush (async callback inside server.close)
    await new Promise((r) => setTimeout(r, 0));

    expect(closeSpy).toHaveBeenCalled();
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);

    closeSpy.mockRestore();
  });

  it('forces shutdown after 10s timeout if server.close() hangs', async () => {
    vi.useFakeTimers();
    const { logger } = await import('../lib/logger');

    // Mock server.close to never call the callback (simulating hanging connections)
    const closeSpy = vi.spyOn(server, 'close').mockImplementation((() => {
      return server;
    }) as never);

    expect(newSigtermHandlers.length).toBeGreaterThanOrEqual(1);
    newSigtermHandlers[0]();

    // Advance time by 10 seconds to trigger forced shutdown
    await vi.advanceTimersByTimeAsync(10_000);

    expect(logger.error).toHaveBeenCalledWith('Forced shutdown after timeout');
    expect(processExitSpy).toHaveBeenCalledWith(1);

    closeSpy.mockRestore();
    vi.useRealTimers();
  });
});
