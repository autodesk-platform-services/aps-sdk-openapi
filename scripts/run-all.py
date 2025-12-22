#!/usr/bin/env python3
"""Run an end-to-end smoke flow:
- ensure node/npm present
- install deps for tools/mcp and tools/cli if missing
- build both projects
- start mcp (production start from dist) with provided spec
- wait for /__status
- run smoke HTTP tests (GET/POST/DELETE)
- run CLI call (node dist/cli.js call ...)
- report results and exit with non-zero code on failure

Usage: python scripts/run-all.py [--spec path] [--port N] [--timeout N]
"""
from __future__ import annotations
import argparse
import os
import shutil
import subprocess
import sys
import time
import json
from pathlib import Path
import urllib.request
import urllib.error

# For packaging into a single executable we prefer runtime-relative defaults
# Use current working directory for defaults so the EXE can be run from the repo root.
REPO_ROOT = Path.cwd()
MCP_DIR = REPO_ROOT / 'tools' / 'mcp'
CLI_DIR = REPO_ROOT / 'tools' / 'cli'
DEFAULT_SPEC = REPO_ROOT / 'examples' / 'petstore.yaml'


def check_node_npm():
    for exe in ('node', 'npm'):
        if shutil.which(exe) is None:
            print(f"Error: {exe} not found in PATH. Please install Node.js >= 18 and npm.", file=sys.stderr)
            return False
    return True


def run(cmd, cwd=None, env=None, check=True, shell=False):
    print(f"Running: {' '.join(cmd) if not shell else cmd} (cwd={cwd})")
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, env=env, check=check, shell=shell)


def ensure_deps_and_build():
    # MCP
    print('\n-- Installing and building MCP server --')
    run(['npm', 'install'], cwd=MCP_DIR)
    run(['npm', 'run', 'build'], cwd=MCP_DIR)

    # CLI
    print('\n-- Installing and building CLI --')
    run(['npm', 'install'], cwd=CLI_DIR)
    run(['npm', 'run', 'build'], cwd=CLI_DIR)


class MCPProc:
    def __init__(self, spec: Path, port: int):
        self.spec = spec
        self.port = port
        self.proc = None

    def start(self):
        cmd = ['npm', 'run', 'start', '--', str(self.spec)]
        print(f"Starting MCP: {' '.join(cmd)}")
        self.proc = subprocess.Popen(cmd, cwd=str(MCP_DIR), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    def is_running(self):
        return self.proc and self.proc.poll() is None

    def stop(self):
        if self.is_running():
            print('Stopping MCP...')
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except Exception:
                self.proc.kill()


def wait_for_status(port: int, timeout: int = 30) -> bool:
    url = f'http://localhost:{port}/__status'
    print(f'Waiting for {url} (timeout {timeout}s)')
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as res:
                if res.status == 200:
                    print('MCP is ready')
                    return True
        except Exception:
            pass
        time.sleep(1)
    print('Timed out waiting for MCP readiness', file=sys.stderr)
    return False


def http_get_json(url: str):
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as res:
        data = res.read().decode('utf-8')
        return json.loads(data)


def http_post_json(url: str, body: dict):
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as res:
        if res.status not in (200, 201):
            raise RuntimeError(f'Unexpected status: {res.status}')
        return json.loads(res.read().decode('utf-8'))


def http_delete(url: str):
    req = urllib.request.Request(url, method='DELETE')
    with urllib.request.urlopen(req, timeout=5) as res:
        return res.status


def run_cli_call(base_url: str):
    cli_js = CLI_DIR / 'dist' / 'cli.js'
    if not cli_js.exists():
        raise RuntimeError('Built CLI not found at dist/cli.js')
    cmd = ['node', str(cli_js), 'call', 'GET', '/pets', '--base', base_url]
    print('Running CLI:', ' '.join(cmd))
    proc = subprocess.run(cmd, cwd=str(CLI_DIR), capture_output=True, text=True)
    print('CLI stdout:\n', proc.stdout)
    print('CLI stderr:\n', proc.stderr, file=sys.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f'CLI exited with {proc.returncode}')


def smoke_tests(base_url: str):
    # GET /pets
    url = f'{base_url}/pets'
    data = http_get_json(url)
    if not isinstance(data, list):
        raise RuntimeError('GET /pets did not return a JSON array')
    print('GET /pets returned array length', len(data))

    # POST /pets
    payload = {'name': 'smoke-pet', 'tag': 'smoke'}
    created = http_post_json(url, payload)
    if not isinstance(created, dict) or 'id' not in created:
        raise RuntimeError('POST /pets did not return created pet with id')
    pet_id = created['id']
    print('Created pet id', pet_id)

    # Ensure GET contains it
    data2 = http_get_json(url)
    if not any((p.get('id') == pet_id for p in data2)):
        raise RuntimeError('Created pet not found in GET /pets results')

    # DELETE /pets/{id}
    del_url = f'{base_url}/pets/{pet_id}'
    status = None
    try:
        status = http_delete(del_url)
    except urllib.error.HTTPError as e:
        status = e.code
    if status != 204:
        raise RuntimeError(f'DELETE did not return 204 (got {status})')
    print('DELETE returned 204 as expected')


def parse_args(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--spec', '-s', default=str(DEFAULT_SPEC))
    p.add_argument('--port', '-p', type=int, default=3000)
    p.add_argument('--timeout', '-t', type=int, default=30)
    p.add_argument('--skip-install', action='store_true', help='Skip npm install steps')
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    spec = Path(args.spec)
    port = args.port
    timeout = args.timeout

    if not check_node_npm():
        return 10

    try:
        if not args.skip_install:
            ensure_deps_and_build()
        else:
            print('Skipping install/build as requested')

        mcp = MCPProc(spec=spec, port=port)
        mcp.start()

        if not wait_for_status(port=port, timeout=timeout):
            mcp.stop()
            return 2

        base = f'http://localhost:{port}'

        print('\n-- Running smoke HTTP tests --')
        smoke_tests(base)

        print('\n-- Running CLI integration call --')
        run_cli_call(base)

        print('\nALL CHECKS PASSED ✅')
        return 0

    except Exception as e:
        print('ERROR:', e, file=sys.stderr)
        return 3

    finally:
        try:
            if 'mcp' in locals():
                mcp.stop()
        except Exception:
            pass


if __name__ == '__main__':
    sys.exit(main())
