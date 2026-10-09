"""scripts/lib/archive/hf_upload.py: push the deep archive to Hugging Face (scripts/archive.mjs --upload).

Usage: HF_TOKEN=... python hf_upload.py <plan.json>
plan.json: {"repo": "owner/name", "card": "<README.md path>",
            "commits": [{"family": "...", "message": "...", "files": [{"local": "...", "path": "..."}]}]}
Creates the dataset repo if missing (public), uploads the card, then one commit per family, and
prints {"family": commit_oid, ...} as JSON. The token comes from the environment only and is
never printed.
"""
import json, os, sys
from huggingface_hub import HfApi, CommitOperationAdd

plan = json.load(open(sys.argv[1]))
token = os.environ.get("HF_TOKEN")
if not token:
    sys.exit("hf_upload: HF_TOKEN is not set")
api = HfApi(token=token)
repo = plan["repo"]
api.create_repo(repo_id=repo, repo_type="dataset", private=False, exist_ok=True)
out = {}
if plan.get("card"):
    info = api.upload_file(path_or_fileobj=plan["card"], path_in_repo="README.md", repo_id=repo, repo_type="dataset",
                           commit_message="Dataset card")
    out["_card"] = getattr(info, "oid", None) or str(info)
for c in plan["commits"]:
    if not c["files"]:
        continue
    ops = [CommitOperationAdd(path_in_repo=f["path"], path_or_fileobj=f["local"]) for f in c["files"]]
    info = api.create_commit(repo_id=repo, repo_type="dataset", operations=ops, commit_message=c["message"])
    out[c["family"]] = info.oid
    print(f"committed {c['family']}: {len(ops)} files", file=sys.stderr)
print(json.dumps(out))
