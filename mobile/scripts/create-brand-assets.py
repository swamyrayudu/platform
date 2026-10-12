"""Compatibility entry point for the shared app/website logo generator."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
subprocess.run(['node', str(root / 'scripts' / 'create-brand-assets.mjs')], check=True)
