"""Twinclue's public sandbox on Modal: one small CPU container running `SANDBOX=1`.

The image mirrors the repository Dockerfile (Node 22, `npm ci`, the test suite,
`npm run build`, then `npm prune --omit=dev`) on Modal's Debian base, because
Modal needs Python in the image and the Dockerfile's Alpine base has none.
No Twitch credentials or other secrets are used: the sandbox needs none.

Deploy from the repository root:

    modal deploy deploy/modal-sandbox/app.py

See docs/DEPLOY.md.
"""

import os
import signal
import subprocess
from pathlib import Path

import modal

APP_NAME = "twinclue-sandbox"
LABEL = "twinclue-sandbox"
PORT = 3000
NODE_VERSION = "22.22.3"

# Read when the app is deployed, so a redeploy can change them.
CPU = float(os.environ.get("TWINCLUE_SANDBOX_CPU", "0.5"))
MEMORY_MB = int(os.environ.get("TWINCLUE_SANDBOX_MEMORY_MB", "512"))
MEMORY_LIMIT_MB = int(os.environ.get("TWINCLUE_SANDBOX_MEMORY_LIMIT_MB", "1024"))
# The page's own address. The server refuses actions whose Origin is not this.
PUBLIC_URL = os.environ.get(
    "TWINCLUE_SANDBOX_PUBLIC_URL", f"https://applemacbook6sep2004--{LABEL}.us-east.modal.run"
)
MAX_GAMES = os.environ.get("TWINCLUE_SANDBOX_MAX_GAMES", "200")

# In the container this file is /root/app.py and the repository is not there;
# the paths are only read on the machine that runs `modal deploy`.
ROOT = Path(__file__).resolve().parent.parent.parent if modal.is_local() else Path("/")


def _skip(path: Path) -> bool:
    return any(part in {"node_modules", "dist", "data", ".DS_Store"} for part in path.parts)


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "xz-utils", "ca-certificates")
    .run_commands(
        # Official Node.js build, checked against the release's published checksums.
        f"cd /tmp && curl -fsSLO https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-x64.tar.xz"
        f" && curl -fsSL https://nodejs.org/dist/v{NODE_VERSION}/SHASUMS256.txt | grep ' node-v{NODE_VERSION}-linux-x64.tar.xz$' | sha256sum -c -"
        f" && tar -xJf node-v{NODE_VERSION}-linux-x64.tar.xz -C /usr/local --strip-components=1"
        f" && rm node-v{NODE_VERSION}-linux-x64.tar.xz && node --version",
    )
    .add_local_file(ROOT / "package.json", "/app/package.json", copy=True)
    .add_local_file(ROOT / "package-lock.json", "/app/package-lock.json", copy=True)
    .add_local_file(ROOT / "tsconfig.json", "/app/tsconfig.json", copy=True)
    .add_local_dir(ROOT / "src", "/app/src", copy=True, ignore=_skip)
    .add_local_dir(ROOT / "public", "/app/public", copy=True, ignore=_skip)
    .add_local_dir(ROOT / "facts", "/app/facts", copy=True, ignore=_skip)
    # The sanitised Codex replay served at /codex (and checked for secrets by the test suite below).
    .add_local_dir(ROOT / "docs" / "codex", "/app/docs/codex", copy=True, ignore=_skip)
    # The /codex page test checks the README links to it.
    .add_local_file(ROOT / "README.md", "/app/README.md", copy=True)
    # Same steps as the Dockerfile, plus the tests, so a red suite never ships.
    .run_commands(
        "cd /app && npm ci && npm test && npm run build && npm prune --omit=dev && rm -rf src tsconfig.json"
    )
    .env({"NODE_ENV": "production"})
)

app = modal.App(APP_NAME)


@app.cls(
    image=image,
    cpu=CPU,
    memory=(MEMORY_MB, MEMORY_LIMIT_MB),
    min_containers=1,
    max_containers=1,
    timeout=24 * 3600,
)
@modal.concurrent(max_inputs=500)
class Sandbox:
    @modal.enter()
    def start(self) -> None:
        env = {
            # Only what the sandbox needs; no secrets reach the process.
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": "/tmp",
            "NODE_ENV": "production",
            "SANDBOX": "1",
            "PUBLIC": "1",
            "PORT": str(PORT),
            "TRUST_PROXY": "1",
            "PUBLIC_URL": PUBLIC_URL,
            "SANDBOX_MAX_GAMES": MAX_GAMES,
        }
        self.proc = subprocess.Popen(["node", "dist/server.js"], cwd="/app", env=env)

    @modal.web_server(PORT, startup_timeout=60, label=LABEL)
    def serve(self) -> None:
        pass

    @modal.exit()
    def stop(self) -> None:
        self.proc.send_signal(signal.SIGTERM)
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
