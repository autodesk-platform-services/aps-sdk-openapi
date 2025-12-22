#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const mcpCwd = path.join(repoRoot, 'tools', 'mcp');
const cliCwd = path.join(repoRoot, 'tools', 'cli');
const specPath = path.join(repoRoot, 'examples', 'petstore.yaml');

console.log('Starting MCP server...');
const mcpProc = spawn('npm', ['run', 'dev', '--', specPath], { cwd: mcpCwd, stdio: 'inherit', shell: true });

let finished = false;

function cleanupAndExit(code = 0) {
  if (finished) return;
  finished = true;
  if (mcpProc && !mcpProc.killed) {
    try { mcpProc.kill(); } catch (e) {}
  }
  process.exit(code);
}

process.on('SIGINT', () => { console.log('Interrupted, shutting down...'); cleanupAndExit(1); });
process.on('SIGTERM', () => { console.log('Terminated, shutting down...'); cleanupAndExit(1); });

// poll /__status until ready (timeout 30s)
const maxAttempts = 30;
let attempts = 0;

function checkStatus() {
  attempts += 1;
  http.get('http://localhost:3000/__status', (res) => {
    if (res.statusCode === 200) {
      console.log('MCP server is ready; running CLI call...');
      runCliCall();
    } else {
      retryOrFail();
    }
  }).on('error', () => {
    retryOrFail();
  });
}

function retryOrFail() {
  if (attempts >= maxAttempts) {
    console.error('Timed out waiting for MCP server to be ready.');
    cleanupAndExit(2);
  } else {
    setTimeout(checkStatus, 1000);
  }
}

function runCliCall() {
  const cli = spawn('npm', ['run', 'dev', '--', 'call', 'GET', '/pets', '--base', 'http://localhost:3000'], { cwd: cliCwd, stdio: 'inherit', shell: true });
  cli.on('exit', (code) => {
    console.log(`CLI call exited with code ${code}`);
    cleanupAndExit(code === null ? 0 : code);
  });
  cli.on('error', (err) => {
    console.error('Error running CLI:', err);
    cleanupAndExit(3);
  });
}

// Start polling
setTimeout(checkStatus, 1000);
