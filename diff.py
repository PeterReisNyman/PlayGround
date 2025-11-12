import difflib
from pathlib import Path


def diff(old_path: str, new_path: str, context: int = 3) -> None:
    """Print a unified diff between two files. Shows 'No changes' if identical.

    Args:
        old_path: Path to the reference file.
        new_path: Path to the candidate file.
        context: Number of context lines in each hunk.
    """
    old_file = Path(old_path)
    new_file = Path(new_path)

    if not old_file.exists():
        print(f"[missing] {old_file}")
        return
    if not new_file.exists():
        print(f"[missing] {new_file}")
        return

    old_lines = old_file.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
    new_lines = new_file.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)

    if old_lines == new_lines:
        print(f"= No changes: {old_file.name}")
        return

    diff_iter = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=str(old_file),
        tofile=str(new_file),
        n=context,
    )
    # Print the diff. difflib already includes headers and hunk lines.
    print(''.join(diff_iter), end='')

new = '/Users/peternyman/Documents/GitHub/VidifyApp/NodeCore/Sources/NodeCore/Core/Renderer/'


old = '/Users/peternyman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Home/Node_OLD/Node_07/Node_07/Core/Renderer/'

files = [
    'FinalVideoAssembler.swift',
    'AudioAssembler.swift',
    'FrameRenderer.swift'
]

for file in files:
    diff(old+file,new+file)