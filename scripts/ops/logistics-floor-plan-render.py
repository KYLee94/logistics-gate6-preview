#!/usr/bin/env python
"""Render only manifest-selected PDF pages to local PNG files. No network or Supabase calls."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

try:
    import pymupdf
except ImportError as exc:
    raise SystemExit(
        "PyMuPDF is required. Install it in a local tools directory, then set PYTHONPATH before running this script."
    ) from exc


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "ops" / "manifests" / "logistics-floor-plan-manifest.json"
DEFAULT_OUT_DIR = ROOT / "qa-artifacts" / "logistics-gate6" / "floor-plan-prepared-images"


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def output_path(out_dir: Path, manifest: dict, asset: dict, plan: dict, candidate_index: int) -> Path:
    if asset["asset_identity_status"] == "verified" and plan["registration_status"] == "ready":
        return out_dir / manifest["storage"]["path_prefix"] / asset["asset_id"] / plan["output_filename"]
    suffix = f"-candidate-{candidate_index + 1}" if len(plan["source_candidates"]) > 1 else ""
    stem = Path(plan["output_filename"]).stem
    return out_dir / "review-required" / asset["asset_id"] / f"{stem}{suffix}.png"


def render(manifest: dict, out_dir: Path, dpi: int, include_blocked: bool, verify_hashes: bool, force: bool) -> dict:
    if dpi < 72 or dpi > 300:
        raise ValueError("dpi must be between 72 and 300")
    rendered, skipped = [], []
    document_cache: dict[str, pymupdf.Document] = {}
    hash_cache: dict[str, str] = {}
    try:
        for asset in manifest["assets"]:
            for plan in asset["floor_plans"]:
                eligible = asset["asset_identity_status"] == "verified" and plan["registration_status"] == "ready"
                if not eligible and not include_blocked:
                    skipped.append({"asset_id": asset["asset_id"], "floor_label": plan["floor_label"], "reason": plan["blockers"]})
                    continue
                for candidate_index, candidate in enumerate(plan["source_candidates"]):
                    source_path = Path(candidate["source_path"])
                    if not source_path.is_file():
                        raise FileNotFoundError(f"Source PDF not found: {source_path}")
                    if verify_hashes:
                        actual_hash = hash_cache.setdefault(str(source_path), sha256_file(source_path))
                        if actual_hash != candidate["sha256"]:
                            raise ValueError(f"Source hash mismatch: {source_path}")
                    document = document_cache.setdefault(str(source_path), pymupdf.open(source_path))
                    page_number = candidate["source_page"]
                    if page_number > document.page_count:
                        raise ValueError(f"Page {page_number} exceeds {document.page_count} pages: {source_path}")
                    destination = output_path(out_dir, manifest, asset, plan, candidate_index)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    if force or not destination.exists():
                        page = document[page_number - 1]
                        scale = dpi / 72
                        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                        pixmap.save(destination)
                    rendered.append({
                        "asset_id": asset["asset_id"],
                        "floor_label": plan["floor_label"],
                        "drawing_number": plan["drawing_number"],
                        "source_file_name": candidate["source_file_name"],
                        "source_page": page_number,
                        "output_path": str(destination),
                    })
    finally:
        for document in document_cache.values():
            document.close()
    return {"rendered": rendered, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description="Render manifest-selected floor-plan pages locally without uploads.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--dpi", type=int, default=None)
    parser.add_argument("--include-blocked", action="store_true", help="Render review-only candidates but never make them registration-ready.")
    parser.add_argument("--verify-source-hashes", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    result = render(
        manifest=manifest,
        out_dir=args.out_dir,
        dpi=args.dpi or manifest["render_defaults"]["dpi"],
        include_blocked=args.include_blocked,
        verify_hashes=args.verify_source_hashes,
        force=args.force,
    )
    report = {
        "ok": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database_write_performed": False,
        "storage_upload_performed": False,
        "rendered_count": len(result["rendered"]),
        "skipped_count": len(result["skipped"]),
        **result,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "render-index.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "rendered_count": report["rendered_count"], "skipped_count": report["skipped_count"], "out_dir": str(args.out_dir)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
