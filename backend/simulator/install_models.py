"""Install the pinned, checksum-verified public SKY130 MOS/BJT typical subset.

Only build-time downloads. Runtime visitors cannot supply model paths or code.
Upstream license headers and LICENSE are retained with the installed model.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path


def install(destination):
    lock = json.loads(Path(__file__).with_name('sky130-lock.json').read_text())
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    contents = {}
    for name, expected in lock['files'].items():
        url = f"https://raw.githubusercontent.com/{lock['repository']}/{lock['revision']}/{name}"
        data = urllib.request.urlopen(url, timeout=60).read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Model checksum mismatch: {name}')
        contents[name] = data.decode()
    # all.spice supplies scale and common parameters; its unrelated device includes
    # are omitted. The two selected corner wrappers include pm3 files explicitly below.
    parts = ['* Gnimula packaged SKY130 MOS/BJT typical subset. See manifest.json and LICENSE.']
    for name in lock['order']:
        content = contents[name]
        lines = [line for line in content.splitlines() if not line.lower().startswith('.include')]
        parts.extend([f'\n* Upstream file: {name}', '\n'.join(lines)])
    (destination/'sky130-tt.spice').write_text('\n'.join(parts)+'\n')
    (destination/'LICENSE').write_text(contents['LICENSE'])
    (destination/'manifest.json').write_text(json.dumps(lock, indent=2)+'\n')
    print('Installed checksum-verified SKY130 MOS/BJT typical models.')


if __name__ == '__main__':
    install(sys.argv[1] if len(sys.argv) > 1 else '/app/models')
