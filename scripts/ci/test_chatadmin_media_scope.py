import unittest

from chatadmin_media_scope import select, video_required


class MediaScopeTest(unittest.TestCase):
    def test_unrelated_paths(self):
        self.assertFalse(video_required([b"docs/sales/handbook.md", b"src/app/global.css",
                                         b"tests/chat-admin-media-pg17.test.mjs"]))

    def test_unknown_mixed_empty_or_unusual_paths(self):
        for paths in ([], [b"docs/sales/file.json"], [b"tests/new.mjs", b"src/app/a.css"],
                      [b"src/app/a\n.css"], [b"docs/operations/chat-admin-media-runtime-reference.json"],
                      [b"package-lock.json"], [b"scripts/ci/chatadmin_media_scope.py"]):
            self.assertTrue(video_required(paths), paths)

    def test_full_diagnostics_and_unbound_diffs(self):
        self.assertTrue(select("workflow_dispatch", "a" * 40, "b" * 40))
        self.assertTrue(select("pull_request", "", ""))


if __name__ == "__main__":
    unittest.main()
