import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import app from '../../../../api/src/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class AdapterSocket extends Duplex {
  public readonly chunks: Buffer[] = [];

  _read() {}

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

// This bridges Next's Fetch API request/response objects to Express's Node HTTP interface.
async function handle(request: Request): Promise<Response> {
  const socket = new AdapterSocket();
  const nodeSocket = socket as unknown as Socket;
  const nodeRequest = new IncomingMessage(nodeSocket);
  const url = new URL(request.url);
  nodeRequest.method = request.method;
  nodeRequest.url = `${url.pathname}${url.search}`;
  nodeRequest.headers = Object.fromEntries(request.headers.entries());
  nodeRequest.push(Buffer.from(await request.arrayBuffer()));
  nodeRequest.push(null);

  const nodeResponse = new ServerResponse(nodeRequest);
  nodeResponse.assignSocket(nodeSocket);

  return new Promise((resolve, reject) => {
    nodeResponse.once('finish', () => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(nodeResponse.getHeaders())) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      }
      const rawResponse = Buffer.concat(socket.chunks);
      const headerBoundary = rawResponse.indexOf('\r\n\r\n');
      const body = headerBoundary === -1 ? rawResponse : rawResponse.subarray(headerBoundary + 4);
      resolve(new Response(body, { status: nodeResponse.statusCode, headers }));
    });
    nodeResponse.once('error', reject);
    app(nodeRequest, nodeResponse);
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
