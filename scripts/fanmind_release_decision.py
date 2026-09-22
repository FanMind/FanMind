#!/usr/bin/env python3
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from fanmind_release_decision_core_round11 import *  # noqa: F401,F403,E402


if __name__ == "__main__":
    raise SystemExit(main())
