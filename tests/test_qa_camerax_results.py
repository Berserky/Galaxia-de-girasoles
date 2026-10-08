import importlib.util
import tempfile
import unittest
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "scripts" / "qa_camerax_report.py"
spec = importlib.util.spec_from_file_location("qa_camerax_report", source)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

PHOTO, VIDEO = gate.REQUIRED
CLASS = "com.nuestragalaxia.companion.GalaxyMediaExperienceTest"


def xml(photo="", video=""):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<testsuite tests="3">
  <testcase classname="{CLASS}" name="nativeGalleryReview_previewsRemovesAndCancelsWithoutUpload"/>
  <testcase classname="{CLASS}" name="{PHOTO}">{photo}</testcase>
  <testcase classname="{CLASS}" name="{VIDEO}">{video}</testcase>
</testsuite>"""


class GateTest(unittest.TestCase):
    def verify(self, content):
        with tempfile.TemporaryDirectory() as dir_path:
            file = Path(dir_path) / "TEST-GalaxyMediaExperienceTest.xml"
            file.write_text(content, encoding="utf8")
            return gate.verify([file])

    def test_both_photo_and_video_pass(self):
        result = self.verify(xml())
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["requiredCameraCases"], 2)

    def test_photo_skipped_fails_closed(self):
        with self.assertRaisesRegex(gate.CameraCoverageError, "skipped"):
            self.verify(xml("<skipped/>"))

    def test_video_skipped_fails_closed(self):
        with self.assertRaisesRegex(gate.CameraCoverageError, "skipped"):
            self.verify(xml(video="<skipped message='no camera'/>"))

    def test_camera_failure_fails_closed(self):
        with self.assertRaisesRegex(gate.CameraCoverageError, "failed"):
            self.verify(xml(video="<failure message='camera crashed'/>"))

    def test_missing_video_fails_closed(self):
        with self.assertRaisesRegex(gate.CameraCoverageError, "Missing CameraX results"):
            self.verify(xml().replace(f'<testcase classname="{CLASS}" name="{VIDEO}"></testcase>', ""))

    def test_missing_reports_fails_closed(self):
        with self.assertRaisesRegex(gate.CameraCoverageError, "No Android JUnit"):
            gate.verify([])


if __name__ == "__main__":
    unittest.main()
