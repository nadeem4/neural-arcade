import argparse
import fnmatch
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

BRANCH_RE = re.compile(r"^(feat|fix|perf|refactor|test|docs|ci|chore)/[a-z0-9]+(-[a-z0-9]+)*$")
CODE_SUFFIXES = (".py", ".js", ".ts", ".tsx", ".go", ".rs", ".java", ".cs")
PROSE_SUFFIXES = (".md", ".txt")
CHECK_TIMEOUT = 540
CHECK_MAP_RE = re.compile(r"^Check \[([^\]]*)\]:(.*)$")
DOCS_NONE_RE = re.compile(r"^Docs: none \(.+\)$", re.M)
LAYOUT_ENTRY_RE = re.compile(r"^- `([^`]+)`")

COMMENT_RE = re.compile(r"^\s*(?:#|//|/\*|\*|--)\s*(.*)$")
SLOP_COMMENT_RES = [
    (re.compile(r"\bnow we\b|added to support", re.I), "narrates the change"),
    (re.compile(r"\bsubagent\b|\bthis PR\b|as requested|per the plan", re.I), "mentions the task"),
    (re.compile(r"^(?!.*(?::|\bwhen\b|\bbecause\b))(increment|returns|sets|gets) the\b", re.I), "restates the code"),
]
EMOJI_RANGES = ((0x1F000, 0x1FAFF), (0x2600, 0x2712), (0x2715, 0x27BF), (0x2B50, 0x2B50), (0x2B55, 0x2B55))
EMOJI_RE = re.compile("[" + "".join(f"{chr(a)}-{chr(b)}" for a, b in EMOJI_RANGES) + "]")


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def check_branch(branch: str) -> str | None:
    if BRANCH_RE.match(branch):
        return None
    return f"branch '{branch}' must look like type/kebab-name (feat, fix, perf, refactor, test, docs, ci, chore)"


def read_check_command(claude_md: Path) -> str | None:
    for line in Path(claude_md).read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.rstrip("\r")
        if line.startswith("Check command:"):
            value = line[len("Check command:"):].strip().strip("`").strip()
            if value and "{{" not in value:
                return value
            return None
    return None


def read_check_map(claude_md: Path) -> list[tuple[list[str], str | None]]:
    mapping = []
    for line in Path(claude_md).read_text(encoding="utf-8", errors="replace").splitlines():
        match = CHECK_MAP_RE.match(line.rstrip("\r"))
        if not match or "{{" in line:
            continue
        globs = [g.strip() for g in match.group(1).split(",") if g.strip()]
        command = match.group(2).strip().strip("`").strip()
        if globs and command:
            mapping.append((globs, None if command == "none" else command))
    return mapping


def select_checks(
    mapping: list[tuple[list[str], str | None]], changed: list[str], full_command: str | None
) -> tuple[list[str], str]:
    full = [full_command] if full_command else []
    if not mapping or not changed:
        return full, "full"
    hit = set()
    for path in changed:
        lines = {i for i, (globs, _) in enumerate(mapping) if any(fnmatch.fnmatchcase(path, g) for g in globs)}
        if not lines:
            return full, f"full (unmapped file: {path})"
        hit |= lines
    commands = []
    for i in sorted(hit):
        command = mapping[i][1]
        if command and command not in commands:
            commands.append(command)
    return commands, "affected" if commands else "docs only"


def added_lines(diff: str) -> list[tuple[str, str]]:
    result = []
    path = None
    in_header = False
    for line in diff.splitlines():
        if line.startswith("diff --git"):
            in_header = True
            path = None
        elif in_header:
            if line.startswith("+++ "):
                target = line[4:]
                path = None if target == "/dev/null" else target.removeprefix("b/")
            elif line.startswith("@@"):
                in_header = False
        elif line.startswith("+") and path:
            result.append((path, line[1:]))
    return result


def find_slop(added: list[tuple[str, str]]) -> list[str]:
    found = []
    for path, text in added:
        if "vendor" in path.split("/")[:-1]:
            continue
        reasons = []
        if EMOJI_RE.search(text):
            reasons.append("emoji")
        comment = COMMENT_RE.match(text)
        if comment and not path.endswith(PROSE_SUFFIXES):
            body = comment.group(1)
            reasons += [why for pattern, why in SLOP_COMMENT_RES if pattern.search(body)]
        for why in reasons:
            found.append(f"{path}: {why}: {text.strip()}")
    return found


def is_test_file(path: str) -> bool:
    parts = path.split("/")
    name = parts[-1]
    return (
        "tests" in parts[:-1] or "test" in parts[:-1] or name.startswith("test_")
        or "_test." in name or ".test." in name or ".spec." in name
    )


def docs_error(changed: list[str], messages: str) -> str | None:
    code = [p for p in changed if p.endswith(CODE_SUFFIXES) and not is_test_file(p)]
    docs = [p for p in changed if p.startswith("docs/") or p.endswith(".md")]
    if not code or docs or DOCS_NONE_RE.search(messages):
        return None
    return "code changed but no docs changed: update the docs, or add a commit line 'Docs: none (reason)'"


def layout_errors(repo: Path, tracked: list[str]) -> list[str]:
    claude_md = repo / "CLAUDE.md"
    if not claude_md.exists():
        return []
    entries = []
    in_layout = False
    found = False
    for line in claude_md.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("## "):
            in_layout = line.rstrip() == "## Layout"
            found = found or in_layout
        elif in_layout and (match := LAYOUT_ENTRY_RE.match(line)):
            if not any(c in match.group(1) for c in ("{{", "*", "<")):
                entries.append(match.group(1).rstrip("/"))
    if not found:
        return []
    if not entries:
        return ['Layout in CLAUDE.md has no entries in the form "- `path`: text"']
    errors = [f"Layout names '{e}' but it does not exist" for e in entries if not (repo / e).exists()]
    covered = {e.split("/")[0] for e in entries}
    folders = sorted({p.split("/")[0] for p in tracked if "/" in p})
    errors += [
        f"top-level folder '{f}' is missing from Layout in CLAUDE.md"
        for f in folders if not f.startswith(".") and f not in covered
    ]
    return errors


def _git(repo: Path, *args: str) -> tuple[int, str]:
    proc = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, check=False
    )
    out = (proc.stdout + proc.stderr if proc.returncode else proc.stdout)
    return proc.returncode, out.decode("utf-8", errors="replace").replace("\r", "")


def _resolve_base(repo: Path, base: str | None) -> str | None:
    for candidate in [base] if base else ["origin/main", "main"]:
        if _git(repo, "rev-parse", "--verify", "--quiet", candidate)[0] == 0:
            return candidate
    return None


def _run_check_command(repo: Path, command: str) -> str | None:
    path = str(Path(sys.executable).parent) + os.pathsep + os.environ.get("PATH", "")
    try:
        proc = subprocess.run(
            command, shell=True, cwd=repo, capture_output=True,
            env=check_env(path), timeout=CHECK_TIMEOUT, check=False,
        )
    except subprocess.TimeoutExpired:
        return f"check command timed out after {CHECK_TIMEOUT}s: {command}"
    if proc.returncode == 0:
        return None
    text = (proc.stdout + proc.stderr).decode("utf-8", errors="replace").replace("\r", "")
    tail = "\n".join(text.splitlines()[-20:])
    return f"check command failed: {command}\n{tail}"


def check_env(path: str) -> dict[str, str]:
    # A hook exports GIT_DIR; a test suite that makes its own repos would write to this one.
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env["PATH"] = path
    return env


def run_checks(
    repo: Path, base: str | None = None, branch: str | None = None, full: bool = False
) -> Report:
    repo = Path(repo)
    report = Report()

    if branch is None:
        branch = _git(repo, "rev-parse", "--abbrev-ref", "HEAD")[1].strip()
    if branch == "HEAD":
        report.errors.append("detached HEAD: check out a named branch")
    elif problem := check_branch(branch):
        report.errors.append(problem)

    claude_md = repo / "CLAUDE.md"
    command = read_check_command(claude_md) if claude_md.exists() else None

    resolved = _resolve_base(repo, base)
    span = f"{resolved}...HEAD"
    changed = _git(repo, "diff", "--name-only", "--no-renames", "-z", span)[1].split("\0") if resolved else []
    changed = [p for p in changed if p]
    mapping = read_check_map(claude_md) if claude_md.exists() and not full else []
    commands, why = select_checks(mapping, changed, command)
    if why == "docs only":
        report.notes.append("checks: none (docs only)")
    elif commands:
        report.notes.append(f"checks: {' && '.join(commands)} (affected)" if why == "affected" else f"checks: {why}")
    if command is None:
        report.warnings.append("no 'Check command:' line in CLAUDE.md" + ("" if commands else "; tests were not run"))
    for cmd in commands:
        if failure := _run_check_command(repo, cmd):
            report.errors.append(failure)

    report.errors += layout_errors(repo, [p for p in _git(repo, "ls-files", "-z")[1].split("\0") if p])

    if resolved is None:
        report.warnings.append("no base branch found (origin/main or main); slop and docs checks skipped")
        return report

    report.errors += find_slop(added_lines(_git(repo, "diff", "--unified=0", span)[1]))
    if error := docs_error(changed, _git(repo, "log", "--format=%B", f"{resolved}..HEAD")[1]):
        report.errors.append(error)
    return report


def only_deletes(pushed: str) -> bool:
    lines = [line.split() for line in pushed.splitlines() if line.strip()]
    return bool(lines) and all(len(parts) == 4 and set(parts[1]) == {"0"} for parts in lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a branch before it is pushed or merged.")
    parser.add_argument("--repo", default=".")
    parser.add_argument("--base", default=None)
    parser.add_argument("--branch", default=None)
    parser.add_argument("--full", action="store_true", help="run the full Check command, ignoring Check [globs] lines")
    parser.add_argument("--hook", action="store_true", help="read the pushed refs git gives a pre-push hook on stdin")
    args = parser.parse_args(argv)

    if args.hook and only_deletes(sys.stdin.read()):
        return 0

    report = run_checks(Path(args.repo), args.base, args.branch, args.full)
    for n in report.notes:
        print(n, file=sys.stderr)
    for w in report.warnings:
        print(f"warning: {w}", file=sys.stderr)
    for e in report.errors:
        print(f"error: {e}", file=sys.stderr)
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
