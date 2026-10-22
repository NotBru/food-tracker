"""Crude stdlib PDF text extractor: inflate FlateDecode streams, pull text from Tj/TJ ops.
Usage: python3 -I pdf_text.py in.pdf out.txt"""
import re, sys, zlib
data = open(sys.argv[1], 'rb').read()
out = []
for m in re.finditer(rb'stream\r?\n', data):
    start = m.end()
    end = data.find(b'endstream', start)
    try:
        s = zlib.decompressobj().decompress(data[start:end])
    except Exception:
        continue
    if b'BT' not in s:
        continue
    parts = []
    for tok in re.finditer(rb'\[(.*?)\]\s*TJ|\((.*?)(?<!\\)\)\s*Tj|(T\*|ET|Td|TD)', s, re.S):
        if tok.group(1) is not None:
            segs = re.findall(rb'\(((?:\\.|[^\\)])*)\)|(-?\d+\.?\d*)', tok.group(1))
            t = b''
            for a, n in segs:
                if a: t += a
                elif n and float(n) < -200: t += b' '
            parts.append(t)
        elif tok.group(2) is not None:
            parts.append(tok.group(2))
        else:
            parts.append(b'\n')
    txt = b''.join(parts).replace(b'\\(', b'(').replace(b'\\)', b')').decode('latin-1')
    out.append(txt)
open(sys.argv[2], 'w').write('\n=====\n'.join(out))
