import { spawn } from 'child_process';
import logger from './logger.js';

let activeTunnelUrl = '';

/**
 * Gets the current active TryCloudflare tunnel URL.
 */
export function getActiveTunnelUrl(): string {
  return activeTunnelUrl;
}

/**
 * Spawns a Cloudflare Quick Tunnel (TryCloudflare) to expose the local Express server.
 */
export function startCloudflareTunnel(port: number) {
  logger.info(`[Cloudflare Tunnel] Starting TryCloudflare quick tunnel for local port ${port}...`);

  // Run cloudflared tunnel --url http://localhost:PORT
  const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);

  child.stdout.on('data', (data) => {
    const output = data.toString();
    parseTunnelOutput(output);
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    parseTunnelOutput(output);
  });

  child.on('close', (code) => {
    logger.warn(`[Cloudflare Tunnel] Process closed with code ${code}. Reconnecting in 10 seconds...`);
    activeTunnelUrl = '';
    setTimeout(() => startCloudflareTunnel(port), 10000);
  });

  child.on('error', (err: any) => {
    if (err.code === 'ENOENT') {
      logger.warn('[Cloudflare Tunnel] "cloudflared" binary not found on the system. Fallback to VPS IP/PUBLIC_URL.');
    } else {
      logger.error('[Cloudflare Tunnel] Process error:', err);
    }
  });
}

function parseTunnelOutput(output: string) {
  // Regex matches temporary TryCloudflare subdomains
  const regex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g;
  const match = output.match(regex);
  if (match && match.length > 0) {
    activeTunnelUrl = match[0];
    logger.info(`=================================================`);
    logger.info(`   [Cloudflare Tunnel] SUCCESS!                  `);
    logger.info(`   Your public TryCloudflare URL is:            `);
    logger.info(`   ${activeTunnelUrl}`);
    logger.info(`=================================================`);
  }
}
