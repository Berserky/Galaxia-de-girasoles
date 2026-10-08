#!/usr/bin/env python3
"""Fail closed when the CameraX emulator silently omits photo or video tests.

Read Android instrumentation JUnit XML, not only Gradle's green exit status.
No external packages; safe for GitHub-hosted Android CI.
"""
import json
import sys
from pathlib import Path
from xml.etree import ElementTree

SUITE = "GalaxyMediaExperienceTest"
REQUIRED = (
    "cameraX_photoRearFrontReviewRetakeAndCancel_whenCameraExists",
    "cameraX_videoHasBoundedRecordingPreviewPlaybackRetakeAndCleanup_whenCameraExists",
)


class CameraCoverageError(RuntimeError):
    pass


def verify(paths):
    paths = list(paths)
    if not paths:
        raise CameraCoverageError("No Android JUnit XML result files found")
    cases = {}
    for path in paths:
        try:
            root = ElementTree.parse(path).getroot()
        except ElementTree.ParseError as exc:
            raise CameraCoverageError(f"Invalid JUnit XML {path}: {exc}") from exc
        for item in root.iter("testcase"):
            if SUITE not in item.get("classname", ""):
                continue
            name = item.get("name", "")
            for required in REQUIRED:
                if not name.startswith(required):
                    continue
                if required in cases:
                    raise CameraCoverageError(f"Duplicate CameraX result: {required}")
                state = (
                    "skipped" if item.find("skipped") is not None or item.get("status") == "skipped"
                    else "failed" if item.find("failure") is not None or item.find("error") is not None
                    else "passed"
                )
                cases[required] = state
    missing = [name for name in REQUIRED if name not in cases]
    if missing:
        raise CameraCoverageError(f"Missing CameraX results: {missing}; found={cases}")
    not_run = {name: value for name, value in cases.items() if value != "passed"}
    if not_run:
        raise CameraCoverageError(f"CameraX tests did not execute and pass: {not_run}")
    return {"status": "VERIFIED", "reportFiles": len(paths), "requiredCameraCases": len(REQUIRED), "cases": cases}


def main():
    base = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build/outputs/androidTest-results")
    if not base.is_dir():
        print(json.dumps({"status": "NOT_EXECUTED", "reason": f"Missing report directory: {base}"}), file=sys.stderr)
        return 1
    try:
        result = verify(base.rglob("TEST-*.xml"))
    except CameraCoverageError as exc:
        print(json.dumps({"status": "NOT_VERIFIED", "reason": str(exc)}), file=sys.stderr)
        return 1
    print("CAMERAX_QA_EVIDENCE=" + json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
