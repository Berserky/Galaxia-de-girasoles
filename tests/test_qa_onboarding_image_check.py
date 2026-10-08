import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image

script=Path(__file__).resolve().parents[1]/"scripts"/"qa-onboarding-image-check.py"
spec=importlib.util.spec_from_file_location("onboard",script)
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

class OnboardingImageGate(unittest.TestCase):
    def test_blank_portrait_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"portrait.png"
            Image.new("RGB",(150,300),(245,245,248)).save(path)
            with self.assertRaisesRegex(AssertionError,"blank/unpainted"):
                gate.inspect(path,"portrait")

    def test_visible_ui_is_accepted(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"portrait.png"
            im=Image.new("RGB",(150,300),(245,245,248))
            for x in range(25,120):
                for y in range(85,135):
                    im.putpixel((x,y),(30,30,35))
            im.save(path)
            gate.inspect(path,"portrait")

    def test_wrong_orientation_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"landscape.png"
            Image.new("RGB",(150,300),(30,30,35)).save(path)
            with self.assertRaisesRegex(AssertionError,"orientation"):
                gate.inspect(path,"landscape")
