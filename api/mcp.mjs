import { handleMcpRequest } from '../server/mcp.mjs';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  return await handleMcpRequest(request);
}
