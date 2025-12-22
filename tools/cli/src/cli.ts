#!/usr/bin/env node
import { Command } from 'commander';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const program = new Command();
program.name('aps').description('APS helper CLI').version('0.1.0');

program
  .command('call <method> <path>')
  .description('Call an endpoint on a running server')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .option('-d, --data <json>', 'JSON payload')
  .action(async (method, endpoint, options) => {
    const url = new URL(endpoint, options.base).toString();
    const body = options.data ? JSON.parse(options.data) : undefined;
    const res = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });
    const txt = await res.text();
    try {
      const json = JSON.parse(txt);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(json, null, 2));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(txt);
    }
  });

program
  .command('generate <spec>')
  .description('Placeholder: generate client SDK from an OpenAPI spec')
  .action((spec) => {
    // Simple placeholder for now
    // eslint-disable-next-line no-console
    console.log(`Would generate SDK from ${spec} (placeholder)`);
  });

program
  .command('mcp:start')
  .description('Start the local MCP mock server (using tools/mcp)')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-s, --spec <file>', 'OpenAPI spec file to load')
  .action(async (opts) => {
    // For development, instruct user to run tools/mcp directly if not built
    // eslint-disable-next-line no-console
    console.log('To start the MCP server for development run:');
    // eslint-disable-next-line no-console
    console.log('  cd tools/mcp && npm install && npm run dev -- [path/to/spec.yaml]');
    // eslint-disable-next-line no-console
    console.log('Or build and run with: cd tools/mcp && npm run build && npm start -- [path/to/spec.yaml]');
  });

program
  .command('mcp:status')
  .description('Query MCP server status')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .action(async (opts) => {
    const res = await fetch(new URL('/mcp/status', opts.base).toString());
    const json = await res.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command('mcp:load <spec>')
  .description('Ask MCP server to load a spec at runtime')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .action(async (spec, opts) => {
    const res = await fetch(new URL('/mcp/load', opts.base).toString(), { method: 'POST', body: JSON.stringify({ spec }), headers: { 'content-type': 'application/json' } });
    const json = await res.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command('mcp:unload <spec>')
  .description('Ask MCP server to unload a spec')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .action(async (spec, opts) => {
    const res = await fetch(new URL('/mcp/unload', opts.base).toString(), { method: 'POST', body: JSON.stringify({ spec }), headers: { 'content-type': 'application/json' } });
    const json = await res.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command('mcp:start-ctrl')
  .description('Ask MCP server to set running state to true')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .action(async (opts) => {
    const res = await fetch(new URL('/mcp/start', opts.base).toString(), { method: 'POST' });
    const json = await res.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command('mcp:stop-ctrl')
  .description('Ask MCP server to set running state to false')
  .option('-b, --base <url>', 'Base URL', 'http://localhost:3000')
  .action(async (opts) => {
    const res = await fetch(new URL('/mcp/stop', opts.base).toString(), { method: 'POST' });
    const json = await res.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  });

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
