# PR CI timing on 27 November 2026

PR #1560 final head provides the baseline. First required check start to last completion was 408 seconds. The two PostgreSQL suites now run on independent service containers and the existing required context accepts only two successful jobs. No database suite is skipped. The Creator and provider tests keep their serial order inside their own database. No release artifact is shared across commits.

The language job skips its web build only for operations documentation and project-memory Markdown on an exact PR merge base. Other paths and ambiguous diffs retain runtime testing. On PRs the memory quality check executes the three memory validators previously also executed by god-mode. Separate manual and main-push god-mode runs retain these validators.
