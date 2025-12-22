# @aps/mcp — Minimal MCP mock server

This is a small Fastify-based mock server that implements a subset of the Petstore OpenAPI example for local testing.

Quick start (dev):

- cd tools/mcp
- npm install
- npm run dev -- [path/to/spec.yaml]

The server supports these routes:
- Dynamic routes generated from provided OpenAPI specs (registered under the same paths)
- GET /__status (server status)
- GET /spec (returns the initially loaded OpenAPI spec when provided)

MCP control endpoints (minimal skeleton):
- GET /mcp/status — inspect running state and loaded specs
- POST /mcp/load — load an OpenAPI spec at runtime ({ spec: "path/to/spec.yaml" })
- POST /mcp/unload — unload a previously loaded spec ({ spec: "path/to/spec.yaml" })
- POST /mcp/start — set server running state to true
- POST /mcp/stop — set server running state to false

This is intended as a simple, local MCP-like server for development and testing. Use `npm run test` to run the basic integration test.
