"""Select native video acceptance for the tested PR merge tree."""
import os
import re
import subprocess


def video_required(paths):
    for path in paths:
        if re.fullmatch(rb"docs/(sales|roadmaps)/[A-Za-z0-9_.-]+\.md|src/app/(?:[A-Za-z0-9_/-]+/)?[A-Za-z0-9_.-]+\.css", path):
            continue
        if path != b"tests/chat-admin-media-pg17.test.mjs":
            return True
    return not paths


def select(event, base, head):
    if event != "pull_request":
        return True
    if not all(re.fullmatch(r"[a-f0-9]{40}", sha) for sha in (base, head)):
        return True
    try:
        parents = subprocess.check_output(["git", "show", "-s", "--format=%P", head]).decode().split()
        if len(parents) != 2 or parents[0] != base:
            return True
        diff = subprocess.check_output(["git", "diff", "--no-ext-diff", "--no-renames",
                                       "--name-only", "-z", base, head, "--"])
    except subprocess.CalledProcessError:
        return True
    return video_required(diff.rstrip(b"\0").split(b"\0") if diff else [])


if __name__ == "__main__":
    required = select(os.environ["GITHUB_EVENT_NAME"], os.environ["BASE_SHA"], os.environ["GITHUB_SHA"])
    with open(os.environ["GITHUB_OUTPUT"], "a") as output, open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        print(f"video={str(required).lower()}", file=output)
        status = "selected" if required else "out of scope (not executed)"
        print(f"Native synthetic video acceptance: {status}", file=summary)
