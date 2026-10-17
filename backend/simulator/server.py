"""Bounded, stateless ngspice subprocess service. Only generated netlists are accepted."""
import json
import math
import os
import re
import resource
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SLOTS = threading.BoundedSemaphore(2)
SAFE_NODE = re.compile(r'^(?:0|in|out|n\d+)$')
SAFE_SOURCE = re.compile(r'^V[a-zA-Z0-9]+$')


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    resource.setrlimit(resource.RLIMIT_FSIZE, (12 * 1024 * 1024, 12 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))


def validate_netlist(netlist):
    if not isinstance(netlist, str) or len(netlist) > 50000:
        raise ValueError('Circuit is too large.')
    lines = netlist.splitlines()
    if not lines or lines[0] != 'Gnimula generated circuit':
        raise ValueError('Expected a generated circuit.')
    allowed_models = {'.model GN NMOS (LEVEL=1 VTO=0.7 KP=120u LAMBDA=0.01)', '.model GP PMOS (LEVEL=1 VTO=-0.7 KP=50u LAMBDA=0.01)'}
    for line in lines[1:]:
        if line.startswith('*') or not line.strip() or line == '.end' or line in allowed_models:
            continue
        if not re.fullmatch(r'[RMCVIX][a-zA-Z0-9]+ [a-zA-Z0-9_ .+\-=()]+', line) or len(line) > 600:
            raise ValueError('Unsupported netlist syntax.')
        if line.startswith('X') and not re.fullmatch(r'X[a-zA-Z0-9]+ (?:0|in|out|n\d+) (?:0|in|out|n\d+) (?:0|in|out|n\d+) (?:0|in|out|n\d+) sky130_fd_pr__(?:nfet|pfet)_01v8 W=[0-9.eE+\-]+ L=[0-9.eE+\-]+', line):
            raise ValueError('Unsupported foundry device.')
        # Excludes directives, shell escapes, paths, quotes, semicolons and control blocks.
    if len(lines) > 150:
        raise ValueError('Too many circuit elements.')
    return '\n'.join(line for line in lines if line != '.end')


def read_table(path):
    if not path.exists():
        return [], []
    lines = path.read_text().strip().splitlines()
    if not lines:
        return [], []
    names = lines[0].split()
    rows = []
    for line in lines[1:]:
        try:
            row = [float(x) for x in line.split()]
            if all(math.isfinite(x) for x in row):
                rows.append(row)
        except ValueError:
            pass
    if len(rows) > 1500:
        rows = rows[::math.ceil(len(rows)/1500)]
    return names, rows


def simulate(payload):
    start = time.monotonic()
    base = validate_netlist(payload.get('netlist'))
    sky = any(line.startswith('X') for line in base.splitlines())
    if sky:
        model_path = Path(os.environ.get('GNIMULA_MODELS_DIR', '/app/models'))/'sky130-tt.spice'
        if not model_path.is_file():
            raise ValueError('The installed SKY130 model service is unavailable.')
        base += f'\n.include "{model_path.resolve()}"\n'
    a = payload.get('analysis', {})
    output = payload.get('output', 'out')
    source = payload.get('source', '')
    input_node = payload.get('input', 'in')
    if not SAFE_NODE.fullmatch(output) or not SAFE_NODE.fullmatch(input_node) or not SAFE_SOURCE.fullmatch(source):
        raise ValueError('Invalid measurement terminal or source.')
    mode = a.get('mode')
    lo, hi = float(a.get('start', 10)), float(a.get('stop', 1e8))
    points = int(a.get('points', 40))
    if not all(math.isfinite(x) for x in (lo, hi)) or not 10 <= points <= 200:
        raise ValueError('Invalid sweep settings.')
    if mode == 'ac':
        if not 0.01 <= lo < hi <= 1e12 or math.log10(hi / lo) * points > 3000:
            raise ValueError('AC sweep must be positive, increasing, and at most 3000 samples.')
        command = f'ac dec {points} {lo} {hi}\nlet gain = v({output})/v({input_node})\nwrdata sweep.dat db(gain) ph(gain)'
        labels = ['Frequency (Hz)', 'Gain (dB)', 'Phase (rad)']
    elif mode == 'dc':
        if not -20 <= lo < hi <= 20:
            raise ValueError('DC sweep range must be within -20 to 20 V.')
        command = f'dc {source} {lo} {hi} {(hi-lo)/points}\nwrdata sweep.dat v({output})'
        labels = ['Input (V)', 'Output (V)']
    elif mode == 'tran':
        if not 1e-9 <= hi <= 1:
            raise ValueError('Transient stop time must be between 1 ns and 1 s.')
        command = f'tran {hi / 600} {hi}\nwrdata sweep.dat v({output})'
        labels = ['Time (s)', 'Output (V)']
    else:
        raise ValueError('Unsupported analysis type.')
    control = f'''\n.control
set noaskquit
set wr_singlescale
set wr_vecnames
op
wrdata operating.dat v({output})
{command}
quit
.endc
.end
'''
    with tempfile.TemporaryDirectory(prefix='gnimula-') as tmp:
        folder = Path(tmp)
        (folder/'circuit.cir').write_text(base + control)
        result = subprocess.run(['ngspice', '-n', '-b', 'circuit.cir'], cwd=tmp, capture_output=True, text=True, timeout=12, preexec_fn=limits, env={'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'HOME':tmp, 'LC_ALL':'C'})
        _, rows = read_table(folder/'sweep.dat')
        _, operating = read_table(folder/'operating.dat')
        log = (result.stdout + result.stderr)[-10000:]
        if not rows:
            raise ValueError('Simulation did not produce data. ' + log[-1800:])
        return {'engine':'ngspice','mode':mode,'labels':labels,'rows':rows,'operatingOutput':operating[0][-1] if operating else None,'elapsedMs':round((time.monotonic()-start)*1000),'log':log,'model':'SKY130 1.8 V NFET/PFET · typical corner (generic models only for any untagged MOS)' if sky else 'Generic Level-1 MOS (educational; no foundry PDK)'}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def do_GET(self):
        body = json.dumps({'ok':True,'engine':'ngspice'}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        acquired = SLOTS.acquire(blocking=False)
        if not acquired:
            self.send_response(429); self.end_headers(); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 70000:
                raise ValueError('Invalid request size.')
            payload = json.loads(self.rfile.read(length))
            result = simulate(payload)
            status = 200
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
            result, status = {'error':str(e)}, 400
        except subprocess.TimeoutExpired:
            result, status = {'error':'Simulation exceeded its 12-second time limit.'}, 422
        except Exception:
            result, status = {'error':'Simulator service failed.'}, 500
        finally:
            SLOTS.release()
        body = json.dumps(result, allow_nan=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','8080'))),Handler).serve_forever()
