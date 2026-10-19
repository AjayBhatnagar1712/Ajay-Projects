"""Download release assets into their original project paths and verify SHA-256."""
import hashlib
import json
import os
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'MIGRATION-MANIFEST.json').read_text(encoding='utf-8'))
for item in manifest:
    if item['storage'] != 'release':
        continue
    destination = (root / item['path']).resolve()
    if not destination.is_relative_to(root):
        raise ValueError('Asset path is outside the repository')
    if destination.exists():
        with destination.open('rb') as stream:
            checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
        if checksum == item['sha256']:
            print('Already verified:', item['path'])
            continue
        raise FileExistsError(f'Existing file differs; preserve it before restoring: {destination}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.download')
    digest = hashlib.sha256()
    size = 0
    print('Downloading:', item['path'], flush=True)
    with urllib.request.urlopen(item['url'], timeout=300) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    if digest.hexdigest() != item['sha256'] or size != item['bytes']:
        temporary.unlink()
        raise RuntimeError('Download checksum mismatch: ' + item['path'])
    os.replace(temporary, destination)
    print('Verified:', item['path'], flush=True)
