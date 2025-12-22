const fetch = require('node-fetch');
const { startServer } = require('../dist/index.js');
const assert = require('assert');

async function run() {
  const server = await startServer({ port: 4001 });

  try {
    const s = await (await fetch('http://localhost:4001/mcp/status')).json();
    assert(s.status && s.status.loadedModels);

    // Load the example spec
    const loadRes = await (await fetch('http://localhost:4001/mcp/load', { method: 'POST', body: JSON.stringify({ spec: '../../examples/petstore.yaml' }), headers: { 'content-type': 'application/json' } })).json();
    assert(loadRes.loaded === '../../examples/petstore.yaml');

    // Call /pets registered by spec
    const pets = await (await fetch('http://localhost:4001/pets')).json();
    assert(Array.isArray(pets));

    console.log('MCP tests passed');
  } catch (err) {
    console.error('MCP tests failed', err);
    process.exitCode = 2;
  } finally {
    await server.close();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });