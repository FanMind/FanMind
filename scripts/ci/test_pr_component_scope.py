import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest

from pr_component_scope import changed_paths, mobile_build_required, video_required


class ComponentScopeTest(unittest.TestCase):
    def test_unrelated_paths(self):
        self.assertFalse(video_required([b"docs/sales/handbook.md", b"src/app/global.css",
                                         b"tests/chat-admin-media-pg17.test.mjs"]))

    def test_unknown_mixed_empty_or_unusual_paths(self):
        for paths in ([], [b"docs/sales/file.json"], [b"tests/new.mjs", b"src/app/a.css"],
                      [b"src/app/a\n.css"], [b"docs/operations/chat-admin-media-runtime-reference.json"],
                      [b"package-lock.json"], [b"scripts/ci/chatadmin_media_scope.py"]):
            self.assertTrue(video_required(paths), paths)

    def test_unrelated_product_routes_and_mobile_docs(self):
        route = b"src/app/api/stripe/webhook/route.ts"
        self.assertFalse(video_required([route, b"docs/mobile/STORE_LISTING.md"]))
        for path in (b"src/app/api/chatadmin/media/route.ts", b"package-lock.json",
                     b"scripts/ci/pr_component_scope.py", b"src/lib/shared.ts"):
            self.assertTrue(video_required([route, path]))

    def test_mobile_store_documents_only(self):
        self.assertFalse(mobile_build_required([b"docs/mobile/STORE_LISTING.md"]))
        for paths in ([], [b"docs/mobile/unknown.md"], [b"docs/mobile/STORE_LISTING.md", b"apps/mobile/app.json"]):
            self.assertTrue(mobile_build_required(paths))

    def test_git_merge_diff_retains_both_sides_of_renames(self):
        with TemporaryDirectory() as directory:
            previous = os.getcwd()
            self.addCleanup(os.chdir, previous)
            os.chdir(directory)

            def git(*args):
                return subprocess.check_output(["git", *args], text=True, stderr=subprocess.PIPE).strip()

            git("init", "-b", "main")
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.invalid")
            Path("backend.js").write_text("runtime")
            git("add", ".")
            git("commit", "-m", "base")
            base = git("rev-parse", "HEAD")
            git("checkout", "-b", "topic")
            Path("docs/sales").mkdir(parents=True)
            git("mv", "backend.js", "docs/sales/topic.md")
            git("commit", "-m", "rename")
            git("checkout", "main")
            git("merge", "--no-ff", "topic", "-m", "candidate")
            head = git("rev-parse", "HEAD")
            paths = changed_paths("pull_request", base, head)
            self.assertCountEqual(paths, [b"backend.js", b"docs/sales/topic.md"])
            self.assertTrue(video_required(paths))
            self.assertEqual(changed_paths("pull_request", head, head), [])
            os.chdir(previous)

    def test_full_diagnostics_and_unbound_diffs(self):
        self.assertFalse(changed_paths("workflow_dispatch", "a" * 40, "b" * 40))
        self.assertFalse(changed_paths("pull_request", "", ""))


if __name__ == "__main__":
    unittest.main()
