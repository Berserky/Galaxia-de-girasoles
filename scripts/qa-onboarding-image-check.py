#!/usr/bin/env python3
"""Reject Android QA screenshots whose WebView content has not yet painted."""
import sys
from PIL import Image

def inspect(path,expected):
    im=Image.open(path).convert("RGB")
    w,h=im.size
    if expected=="portrait" and w>=h or expected=="landscape" and w<=h:
        raise AssertionError(f"{expected}: wrong screenshot orientation {w}x{h}")
    dark=total=0
    for y in range(int(h*.15),int(h*.85),max(1,h//180)):
        for x in range(int(w*.08),int(w*.92),max(1,w//180)):
            r,g,b=im.getpixel((x,y))
            dark+=.2126*r+.7152*g+.0722*b<165
            total+=1
    fraction=dark/max(total,1)
    if fraction<.01:
        raise AssertionError(f"{expected}: blank/unpainted capture (dark fraction {fraction:.4f})")
    print(f"NG_AUD_003_{expected.upper()}_PAINTED={fraction:.4f}")

if __name__=="__main__":
    inspect(sys.argv[1],"portrait")
    inspect(sys.argv[2],"landscape")
    print("NG_AUD_003_SCREENSHOT=RENDER_VERIFIED")
