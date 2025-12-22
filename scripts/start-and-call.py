#!/usr/bin/env python3
"""Start the MCP mock server, wait for it to be ready, then run a CLI call.

Supports command-line options to control spec path, port, timeout and the CLI command to run.
"""
import argparse
import shlex
import subprocess
import time
import sys
from pathlib import Path
import urllib.request

REPO_ROOT = Path(__file__).resolve().parents[1]
MCP_CWD = REPO_ROOT / 'tools' / 'mcp'
CLI_CWD = REPO_ROOT / 'tools' / 'cli'
DEFAULT_SPEC = REPO_ROOT / 'examples' / 'petstore.yaml'
DEFAULT_PORT = 3000


def start_mcp(spec: str):
    print(f"Starting MCP server with spec: {spec}")
    cmd = f"npm run dev -- {shlex.quote(str(spec))}"
    proc = subprocess.Popen(cmd, cwd=str(MCP_CWD), shell=True)
    return proc


def wait_for_status(port: int = DEFAULT_PORT, timeout: int = 30):
    url = f'http://localhost:{port}/__status'
    print(f'Waiting for MCP server to be ready at {url} (timeout {timeout}s)')
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as res:
                if res.status == 200:
                    print('MCP server is ready')
                    return True
        except Exception:
            pass
        time.sleep(1)
    return False


def run_cli_call(cli_args, cwd: Path = CLI_CWD):
    if not cli_args:
        cli_args = ['call', 'GET', '/pets', '--base', f'http://localhost:{DEFAULT_PORT}']
    cmd = 'npm run dev -- ' + ' '.join(shlex.quote(arg) for arg in cli_args)
    print(f'Running CLI command: {cmd}')
    proc = subprocess.Popen(cmd, cwd=str(cwd), shell=True)
    proc.wait()
    return proc.returncode


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description='Start MCP server, wait for readiness, then run a CLI command')
    parser.add_argument('--spec', '-s', default=str(DEFAULT_SPEC), help='Path to OpenAPI spec to load')
    parser.add_argument('--port', '-p', type=int, default=DEFAULT_PORT, help='Port MCP server will listen on')
    parser.add_argument('--timeout', '-t', type=int, default=30, help='Seconds to wait for MCP readiness')
    parser.add_argument('--cli-cmd', '-c', nargs=argparse.REMAINDER, help='CLI command to run after MCP is ready (e.g. call GET /pets --base http://localhost:3000)')
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    spec = args.spec
    port = args.port
    timeout = args.timeout
    cli_cmd = args.cli_cmd

    # If cli_cmd provided and contains {port} placeholder, substitute
    if cli_cmd:
        cli_cmd = [arg.replace('{port}', str(port)) for arg in cli_cmd]

    mcp_proc = None
    try:
        mcp_proc = start_mcp(spec)
        ready = wait_for_status(port=port, timeout=timeout)
        if not ready:
            print('Timed out waiting for MCP server to be ready.', file=sys.stderr)
            return 2
        rc = run_cli_call(cli_cmd)
        print(f'CLI call exited with code {rc}')
        return rc if rc is not None else 0

    except KeyboardInterrupt:
        print('Interrupted, shutting down...', file=sys.stderr)
        return 1
    except Exception as e:
        print('Error:', e, file=sys.stderr)
        return 3
    finally:
        if mcp_proc and mcp_proc.poll() is None:
            try:
                mcp_proc.terminate()
                # wait short time then kill if still alive
                time.sleep(1)
                if mcp_proc.poll() is None:
                    mcp_proc.kill()
            except Exception:
                pass


if __name__ == '__main__':
    sys.exit(main())
