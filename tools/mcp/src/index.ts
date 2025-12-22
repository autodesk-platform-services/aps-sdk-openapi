import Fastify from 'fastify';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export function createServer(specPath?: string) {
  const app = Fastify({ logger: true });

  const store: Array<{ id: number; name: string; tag?: string }> = [];
  let idCounter = 1;

  // Basic routes implementing the petstore subset
  app.get('/pets', async (request, reply) => {
    return store;
  });

  app.post('/pets', async (request: any, reply) => {
    const payload = request.body || {};
    const pet = { id: idCounter++, name: payload.name || `pet-${Math.random()}`, tag: payload.tag };
    store.push(pet);
    return pet;
  });

  app.get('/pets/:id', async (request: any, reply) => {
    const id = parseInt((request.params || {}).id, 10);
    const p = store.find((x) => x.id === id);
    if (!p) return reply.status(404).send({ code: 404, message: 'not found' });
    return p;
  });

  app.delete('/pets/:id', async (request: any, reply) => {
    const id = parseInt((request.params || {}).id, 10);
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return reply.status(404).send({ code: 404, message: 'not found' });
    store.splice(idx, 1);
    return reply.status(204).send();
  });

  // A small control endpoint to show status (MCP-compatible hooks can be added)
  app.get('/__status', async () => ({ status: 'ok', count: store.length }));

  // Runtime MCP state
  const mcpState = { running: true, loadedModels: [] as string[] };

  // If a spec is provided, attempt to load it and expose at /spec for debugging
  const loadedSpecs: Record<string, any> = {};
  async function loadSpecFromPath(specPathInner: string) {
    const absolute = path.isAbsolute(specPathInner) ? specPathInner : path.join(process.cwd(), specPathInner);
    const raw = fs.readFileSync(absolute, 'utf8');
    const doc: any = yaml.load(raw);
    // register paths from doc
    if (doc && doc.paths) {
      for (const [p, methods] of Object.entries<any>(doc.paths)) {
        const fastifyRoute = p.replace(/\{([^}]+)\}/g, ':$1');
        for (const [method, op] of Object.entries<any>(methods)) {
          const responses = op.responses || {};
          const code = Object.keys(responses).find((c) => ['200', '201', 'default'].includes(c)) || Object.keys(responses)[0];
          const resp = responses[code];
          let example: any = undefined;
          try {
            if (resp && resp.content) {
              const mime = Object.keys(resp.content)[0];
              const schema = resp.content[mime].schema;
              // use openapi-sampler to produce an example
              const sampler = require('openapi-sampler');
              example = sampler.sample(schema, doc);
            }
          } catch (err) {
            // ignore sampling errors
          }

          // register route (avoid duplicate registration)
          const routeKey = `${method.toUpperCase()} ${fastifyRoute}`;
          const exists = (app as any).hasRoute && (app as any).hasRoute(routeKey);
          // app.hasRoute doesn't exist; for safety, try/catch register and ignore duplicate
          try {
            app.route({ method: method.toUpperCase(), url: fastifyRoute, handler: async (req, reply) => {
              if (example !== undefined) return reply.send(example);
              // fallback: return basic data if schema describes an array or object
              if (resp && resp.content) {
                const mime = Object.keys(resp.content)[0];
                const schema = resp.content[mime].schema;
                if (schema && schema.type === 'array') return reply.send([]);
                if (schema && schema.type === 'object') return reply.send({});
              }
              return reply.send({ message: 'ok' });
            }});
          } catch (err) {
            // ignore duplicate registration errors
          }
        }
      }
    }
    return doc;
  }

  if (specPath) {
    try {
      const doc = loadSpecFromPath(specPath);
      loadedSpecs[specPath] = doc;
      app.get('/spec', async () => doc);
      mcpState.loadedModels.push(specPath);
    } catch (err) {
      // ignore load errors
    }
  }

  // MCP control endpoints (minimal skeleton)
  app.get('/mcp/status', async () => ({ status: mcpState }));

  app.post('/mcp/load', async (request: any, reply) => {
    const body = request.body || {};
    if (!body.spec) return reply.status(400).send({ error: 'spec path is required' });
    try {
      const doc = await loadSpecFromPath(body.spec);
      loadedSpecs[body.spec] = doc;
      if (!mcpState.loadedModels.includes(body.spec)) mcpState.loadedModels.push(body.spec);
      return reply.send({ loaded: body.spec });
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || String(err) });
    }
  });

  app.post('/mcp/unload', async (request: any, reply) => {
    const body = request.body || {};
    if (!body.spec) return reply.status(400).send({ error: 'spec path is required' });
    const idx = mcpState.loadedModels.indexOf(body.spec);
    if (idx === -1) return reply.status(404).send({ error: 'not loaded' });
    mcpState.loadedModels.splice(idx, 1);
    delete loadedSpecs[body.spec];
    return reply.send({ unloaded: body.spec });
  });

  app.post('/mcp/stop', async () => {
    mcpState.running = false;
    return { stopped: true };
  });

  app.post('/mcp/start', async () => {
    mcpState.running = true;
    return { started: true };
  });

  return app;
}

export async function startServer(opts: { port?: number; spec?: string } = {}) {
  const port = opts.port ?? 3000;
  const server = createServer(opts.spec);
  await server.listen({ port, host: '0.0.0.0' });
  return server;
}

if (require.main === module) {
  const portArg = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const specArg = process.argv[2];
  startServer({ port: portArg, spec: specArg }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
