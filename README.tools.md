# Tools added: CLI and MCP mock server

This repo now includes a minimal Node.js + TypeScript CLI and a small MCP-like mock server for local testing.

Where to look:
- `examples/petstore.yaml` — example OpenAPI spec (Petstore)
- `tools/cli/` — TypeScript CLI (uses `commander`)
- `tools/mcp/` — Fastify mock server implementing a small subset of the Petstore API

Quick start (dev):
- Install deps for tools: `npm install --prefix tools/mcp && npm install --prefix tools/cli`
- Run the convenience command (starts MCP and performs a full smoke test): `npm run start:all` (Python) — this will install/build, start MCP, run HTTP smoke tests and run the CLI call.

You can pass options to the Python script, for example:
- `npm run start:all -- --spec examples/petstore.yaml --port 3005 --timeout 60`

For a lighter dev flow (start server and run one CLI call) you can still use:
- `npm run start:mcp-and-call` (Node) or `npm run start:mcp-and-call-python` (Python)

Build a standalone Windows EXE (optional):
- Locally (Windows): `npm run build:exe` (requires PowerShell and Python/pip)
- CI: there's a `Build Windows EXE` GitHub Action that runs on `main` or via `workflow_dispatch` and produces an artifact `aps-run-all-windows` containing `aps-run-all.exe`.

Release automation:
- When you push a tag like `v1.2.3`, the `Release EXE` workflow will build the EXE and create a GitHub Release for that tag with `aps-run-all.exe` attached as a release asset.

- Or run the services individually:
  - `cd tools/mcp && npm install && npm run dev -- examples/petstore.yaml`
  - `cd tools/cli && npm install && npm run dev -- call GET /pets --base http://localhost:3000`

Next steps:
- Add tests, proper OpenAPI validation, and a `mcp` control API following the MCP spec.
