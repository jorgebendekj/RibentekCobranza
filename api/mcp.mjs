import { handleMcpRequest } from '../server/mcp.mjs';

// Removed runtime: 'edge' to allow Node.js modules to build.
// Vercel Serverless automatically supports Web Standard Request/Response on Node.js 18+.

export default async function handler(request) {
  return await handleMcpRequest(request);
}
