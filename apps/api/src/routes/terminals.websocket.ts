import { Injectable } from '@nestjs/common';
import type { TerminalClientMessage, TerminalServerMessage } from '@ai-manage/shared';
import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { TerminalsService } from './terminals.service.js';

@Injectable()
export class TerminalsWebSocketServer {
  private server?: WebSocketServer;

  constructor(private readonly terminals: TerminalsService) {}

  /** Attaches the terminal websocket endpoint to the existing HTTP server. */
  attach(httpServer: Server) {
    this.server = new WebSocketServer({ server: httpServer, path: '/api/terminals/ws' });
    this.server.on('connection', (socket, request) => this.handleConnection(socket, request));
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage) {
    if (!this.isAllowedOrigin(request.headers.origin)) {
      socket.close(1008, 'Origin not allowed');
      return;
    }

    const sessionId = this.sessionIdFromRequest(request);
    if (!sessionId) {
      this.send(socket, { type: 'error', message: 'Missing terminal session id' });
      socket.close(1008, 'Missing terminal session id');
      return;
    }

    try {
      this.terminals.attachClient(sessionId, socket);
    } catch (error) {
      this.send(socket, { type: 'error', message: error instanceof Error ? error.message : String(error) });
      socket.close(1008, 'Terminal session not found');
      return;
    }

    socket.on('message', data => this.handleMessage(sessionId, socket, data));
    socket.on('close', () => this.terminals.detachClient(sessionId, socket));
  }

  private handleMessage(sessionId: string, socket: WebSocket, data: RawData) {
    const message = this.parseClientMessage(data);
    if (!message) {
      this.send(socket, { type: 'error', message: 'Invalid terminal message' });
      return;
    }

    try {
      this.terminals.handleClientMessage(sessionId, message);
    } catch (error) {
      this.send(socket, { type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  private sessionIdFromRequest(request: IncomingMessage) {
    const host = request.headers.host || '127.0.0.1';
    const url = new URL(request.url || '', `http://${host}`);
    return url.searchParams.get('sessionId') || '';
  }

  private parseClientMessage(data: RawData): TerminalClientMessage | undefined {
    try {
      const parsed = JSON.parse(data.toString()) as Partial<TerminalClientMessage>;
      if (parsed.type === 'input' && typeof parsed.data === 'string') {
        return { type: 'input', data: parsed.data };
      }
      if (parsed.type === 'resize' && typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
        return { type: 'resize', cols: parsed.cols, rows: parsed.rows };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private isAllowedOrigin(origin?: string) {
    if (!origin) return true;
    return /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
  }

  private send(socket: WebSocket, message: TerminalServerMessage) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
