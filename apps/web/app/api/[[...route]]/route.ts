import { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex, Readable } from 'node:stream';
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
  const url = new URL(request.url);
  const body = Buffer.from(await request.arrayBuffer());
  // Express only needs a readable Node request with HTTP metadata. `IncomingMessage`
  // is coupled to a real TCP parser and does not reliably emit POST bodies when
  // constructed against a synthetic socket inside a Next route handler.
  const nodeRequest = Object.assign(Readable.from([body]), {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: { ...Object.fromEntries(request.headers.entries()), 'content-length': String(body.length) },
    socket: nodeSocket,
    connection: nodeSocket,
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
  }) as IncomingMessage;

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
      // Fetch forbids bodies for 204/205/304. Express may emit a conditional 304
      // from its ETag support even though the synthetic socket captured bytes.
      const emptyStatus = nodeResponse.statusCode === 204 || nodeResponse.statusCode === 205 || nodeResponse.statusCode === 304;
      resolve(new Response(emptyStatus ? null : body, { status: nodeResponse.statusCode, headers }));
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
