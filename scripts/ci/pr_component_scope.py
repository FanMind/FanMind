"""Select component checks from the tested PR merge tree."""
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


MOBILE_STORE_DOCUMENTS = {
    b"docs/mobile/STORE_LISTING.md",
    b"docs/mobile/STORE_PRIVACY_DECLARATIONS.md",
    b"docs/mobile/APP_STORE_HANDOFF.md",
    b"docs/mobile/APP_STORE_CONNECT_WORKSHEET.md",
    b"docs/mobile/STORE_REVIEW_ACCESS.md",
    b"docs/mobile/STORE_TESTER_PROGRAM.md",
}


def mobile_build_required(paths):
    return not paths or not set(paths).issubset(MOBILE_STORE_DOCUMENTS)


def changed_paths(event, base, head):
    if event != "pull_request":
        return []
    if not all(re.fullmatch(r"[a-f0-9]{40}", sha) for sha in (base, head)):
        return []
    try:
        parents = subprocess.check_output(["git", "show", "-s", "--format=%P", head]).decode().split()
        if len(parents) != 2 or parents[0] != base:
            return []
        diff = subprocess.check_output(["git", "diff", "--no-ext-diff", "--no-renames",
                                       "--name-only", "-z", base, head, "--"])
    except subprocess.CalledProcessError:
        return []
    return diff.rstrip(b"\0").split(b"\0") if diff else []


if __name__ == "__main__":
    import sys

    component = sys.argv[1]
    classifier = {"video": video_required, "mobile_build": mobile_build_required}[component]
    paths = changed_paths(os.environ["GITHUB_EVENT_NAME"], os.environ["BASE_SHA"], os.environ["GITHUB_SHA"])
    required = classifier(paths)
    with open(os.environ["GITHUB_OUTPUT"], "a") as output, open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        print(f"{component}={str(required).lower()}", file=output)
        status = "selected" if required else "out of scope (not executed)"
        print(f"{component}: {status}", file=summary)
