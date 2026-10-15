"""Publish only the pinned Investor originals to the EXISTING public Atlas archive.

No repo creation, settings/card changes, deletion, overwrite or source transformation.
Uploads stream existing files; unauthenticated readback hashes full response bodies.
Run through the repository's pinned huggingface_hub runtime. Secrets stay in .env.
"""
import argparse, hashlib, json, os, pathlib, re, time, urllib.request
from huggingface_hub import HfApi, CommitOperationAdd

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = pathlib.Path('/home/bhuvanesh.r/.codex/atlas-staging/2026-10-13-wave-2/investor-participation')
REPO = 'bebhuvan1/india-atlas-archive'
NATIVE_PIN = '510f3e363c2af3fc5e557147209742a54ec618e802e493edea70ab7615c7bf17'
PIN = '2cda6379a193c4fab39a90dbf0f8134931d5ca93104e0bd6a8c155ad411fa619'
OUT = ROOT / 'docs/status/investor-implementation-2026-10-15'
sha = lambda b: hashlib.sha256(b).hexdigest()
class ArchiveBoundaryError(Exception): pass

def write_receipt(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / (name + '.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(OUT / name)

def public_read(url, expected):
    for attempt in range(4):
        try:
            # Deliberately no HF token, cookies or Authorization on this request.
            req = urllib.request.Request(url, headers={'User-Agent': 'IndiaAtlas-source-audit/1'})
            with urllib.request.urlopen(req, timeout=90) as r:
                h, size = hashlib.sha256(), 0
                while True:
                    chunk = r.read(1024 * 1024)
                    if not chunk: break
                    size += len(chunk)
                    if size > expected['bytes']: raise ArchiveBoundaryError('public object exceeds pinned size')
                    h.update(chunk)
                if h.hexdigest() != expected['sha256'] or size != expected['bytes']:
                    raise ArchiveBoundaryError('public object SHA/size differs')
                return {'url': url, 'sha256': h.hexdigest(), 'bytes': size,
                        'contentType': r.headers.get('Content-Type'),
                        'contentDisposition': r.headers.get('Content-Disposition'),
                        'authenticated': False, 'fullBodyVerified': True}
        except ArchiveBoundaryError: raise
        except Exception:
            if attempt == 3: raise ArchiveBoundaryError('Public readback unavailable after four attempts') from None
            time.sleep(2 ** attempt)

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--execute', action='store_true')
    opts = args.parse_args()
    if sha((STAGE/'integration-manifest.json').read_bytes()) != PIN: raise ArchiveBoundaryError('Frozen source manifest differs')
    # Check the configured destination in code, rather than accepting a caller-selected repo.
    configured = (ROOT/'scripts/archive.mjs').read_text()
    if f'export const REPO = "{REPO}"' not in configured: raise ArchiveBoundaryError('Configured destination differs')
    evidence = json.loads((STAGE/'upload-evidence.json').read_text())
    native_bytes = (ROOT/'docs/status/investor-proposal-2026-10-15/native-original-formats.json').read_bytes()
    if sha(native_bytes) != NATIVE_PIN: raise ArchiveBoundaryError('Pinned 522-original source inventory differs')
    native = json.loads(native_bytes)
    by_hash = {x['sha256']: x for x in native['records']}
    files = []
    for x in evidence['files']:
        f = pathlib.Path(x['local'])
        if f.is_symlink(): raise ArchiveBoundaryError('Source symlink refused')
        b = f.read_bytes()
        if len(b) != x['bytes'] or sha(b) != x['sha256']: raise ArchiveBoundaryError('Local original changed')
        n = by_hash[x['sha256']]
        if n['bytes'] != x['bytes'] or set(n['officialUrls']) != set(x['official_urls']): raise ArchiveBoundaryError('Original source linkage differs')
        # Correct the ingestion suffix only in the NEW remote object plan. Never rewrite
        # source bytes, frozen plans or an already-published remote object.
        filename = n['proposedDownloadFilename']
        if not re.fullmatch(x['sha256'] + r'\.(json|xls|xlsx)', filename): raise ArchiveBoundaryError('Native filename invalid')
        files.append({'local': str(f), 'path': 'raw/investor-participation/'+filename,
                      'sha256': x['sha256'], 'bytes': x['bytes'], 'format': n['sourceFormat'],
                      'nativeMime': n['proposedContentType'], 'officialUrls': x['official_urls'],
                      'datasets': x['datasets']})
    if len(files) != 522 or len({f['path'] for f in files}) != 522 or sum(f['bytes'] for f in files) != 149934485:
        raise ArchiveBoundaryError('Exact authorized inventory differs')
    env = {}
    for line in (ROOT/'.env').read_text().splitlines():
        m = re.match(r'^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$', line)
        if m: env[m[1]] = m[2].strip('"\'')
    token = os.environ.get('HF_TOKEN') or env.get('HF_TOKEN')
    if not token: raise ArchiveBoundaryError('Configured HF_TOKEN absent; no upload')
    public = HfApi(token=False)
    info = public.repo_info(repo_id=REPO, repo_type='dataset')
    if info.private or info.id != REPO: raise ArchiveBoundaryError('Archive is not the established public dataset')
    # A revision-locked tree plus parent_commit CAS prevents overwriting a path that
    # another writer introduces after this check. A CAS rejection stops, never retries a write.
    parent = info.sha
    tree = {x.path: x for x in public.list_repo_tree(REPO, repo_type='dataset', revision=parent, recursive=True)}
    missing = []
    for f in files:
        if f['path'] in tree:
            public_read(f'https://huggingface.co/datasets/{REPO}/resolve/{parent}/{f["path"]}?download=true', f)
        else: missing.append(f)
    write_receipt('archive-plan.json', {'repo': REPO, 'existingPublicRevision': parent, 'files': files,
                                       'missing': len(missing), 'execute': opts.execute,
                                       'noOverwrite': True, 'nativeSuffixCorrections': 35})
    print(f'Existing public archive confirmed; {len(files)} pinned originals; {len(missing)} missing', flush=True)
    if not opts.execute: return
    api = HfApi(token=token)
    commits = []
    for i in range(0, len(missing), 50):
        batch = missing[i:i+50]
        commit = api.create_commit(repo_id=REPO, repo_type='dataset', parent_commit=parent,
            operations=[CommitOperationAdd(path_in_repo=f['path'], path_or_fileobj=f['local']) for f in batch],
            commit_message=f'Investor original sources: content-addressed objects {i+1} to {i+len(batch)}')
        parent = commit.oid
        commits.append({'oid': parent, 'paths': [f['path'] for f in batch]})
        write_receipt('archive-commits.json', {'repo': REPO, 'commits': commits})
        print(f'Archived {min(i+50,len(missing))}/{len(missing)} missing objects', flush=True)
    readback = []
    for i, f in enumerate(files):
        check = public_read(f'https://huggingface.co/datasets/{REPO}/resolve/{parent}/{f["path"]}?download=true', f)
        readback.append({k:v for k,v in f.items() if k!='local'} | check)
        write_receipt('archive-readback-progress.json', {'repo':REPO,'revision':parent,'verified':len(readback),'files':readback})
        if (i+1)%20==0: print(f'Public full-byte readback {i+1}/522', flush=True)
    inventory = {'schemaVersion':1,'repo':REPO,'revision':parent,'files':readback,'objects':len(readback),
                 'bytes':sum(f['bytes'] for f in readback),'allPublicFullBytesVerified':True,
                 'noOverwrites':True,'noRepoOrSettingsChanges':True,'frozenManifestSha256':PIN}
    write_receipt('public-originals.json', inventory)
    print('All 522 public objects fully verified', flush=True)

if __name__ == '__main__':
    try: main()
    except Exception as e:
        # Never include request headers, credentials or arbitrary SDK exception bodies.
        print('Archive stopped: '+type(e).__name__+(': '+str(e) if isinstance(e,ArchiveBoundaryError) else ''), flush=True)
        raise SystemExit(1)
