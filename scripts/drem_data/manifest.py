"""
Manifest read/write for DREM export bundles.
"""
import json
from datetime import datetime, timezone


def write_manifest(
    output_dir: str,
    source_stack: str,
    source_region: str,
    source_user_pool_id: str,
    counts: dict,
    options: dict,
) -> dict:
    """Write manifest.json to the export directory."""
    manifest = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source_stack": source_stack,
        "source_region": source_region,
        "source_user_pool_id": source_user_pool_id,
        "counts": counts,
        "options": options,
    }
    path = f"{output_dir}/manifest.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest


def read_manifest(input_dir: str) -> dict:
    """Read manifest.json from an export directory."""
    path = f"{input_dir}/manifest.json"
    with open(path) as f:
        return json.load(f)


def update_manifest(input_dir: str, updates: dict):
    """Merge updates into an existing manifest.json."""
    manifest = read_manifest(input_dir)
    manifest.update(updates)
    path = f"{input_dir}/manifest.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
