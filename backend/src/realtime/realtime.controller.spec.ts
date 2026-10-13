import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

describe('RealtimeController', () => {
  let controller: RealtimeController;
  let request: EventEmitter & { headers: Record<string, string> };
  let response: {
    status: jest.Mock;
    setHeader: jest.Mock;
    flushHeaders: jest.Mock;
    write: jest.Mock;
  };
  let prisma: { employee: { findUnique: jest.Mock } };
  let realtimeService: { subscribe: jest.Mock };
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(() => {
    request = Object.assign(new EventEmitter(), { headers: {} });
    response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
    };
    prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          role: Role.ADMIN,
          isActive: true,
          deletedAt: null,
        }),
      },
    };
    realtimeService = {
      subscribe: jest.fn().mockReturnValue(jest.fn()),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 7 }),
    };
    controller = new RealtimeController(
      realtimeService as unknown as RealtimeService,
      prisma as unknown as PrismaService,
      jwtService as never,
      { get: jest.fn().mockReturnValue('test-secret') } as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects requests without a bearer token', async () => {
    await expect(
      controller.events(request as unknown as Request, response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(realtimeService.subscribe).not.toHaveBeenCalled();
  });

  it('rejects an expired access token', async () => {
    request.headers.authorization = 'Bearer expired-token';
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      controller.events(request as unknown as Request, response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(realtimeService.subscribe).not.toHaveBeenCalled();
  });

  it('authenticates valid bearer tokens before opening the event stream', async () => {
    request.headers.authorization = 'Bearer valid-token';

    await controller.events(
      request as unknown as Request,
      response as unknown as Response,
    );

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: 'test-secret',
    });
    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.flushHeaders).toHaveBeenCalledTimes(1);
    expect(response.write).toHaveBeenCalledWith(
      'event: ready\ndata: {"userId":7}\n\n',
    );
    expect(realtimeService.subscribe).toHaveBeenCalledTimes(1);
    request.emit('close');
  });

  it('rejects inactive employees', async () => {
    request.headers.authorization = 'Bearer valid-token';
    prisma.employee.findUnique.mockResolvedValue({
      id: 7,
      role: Role.ADMIN,
      isActive: false,
      deletedAt: null,
    });

    await expect(
      controller.events(request as unknown as Request, response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(realtimeService.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes and clears the heartbeat when the client disconnects', async () => {
    jest.useFakeTimers();
    request.headers.authorization = 'Bearer valid-token';
    const unsubscribe = jest.fn();
    realtimeService.subscribe.mockReturnValue(unsubscribe);

    await controller.events(
      request as unknown as Request,
      response as unknown as Response,
    );
    expect(jest.getTimerCount()).toBe(1);

    request.emit('close');

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
