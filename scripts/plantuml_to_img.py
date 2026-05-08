#!/usr/bin/env python3
"""
将 Markdown 中的 PlantUML 代码块编码为 PlantUML server 的图片链接并替换。

用法:
  python3 scripts/plantuml_to_img.py docs/business-workflow.md

会在原文件中把第一个 ```plantuml ... ``` 区块替换为 `![diagram](https://www.plantuml.com/plantuml/svg/<encoded>)`
"""
import re
import sys
import zlib

PLANTUML_SERVER = "https://www.plantuml.com/plantuml/svg/"

def encode_6bit(b):
    if b < 10:
        return chr(48 + b)
    b -= 10
    if b < 26:
        return chr(65 + b)
    b -= 26
    if b < 26:
        return chr(97 + b)
    b -= 26
    if b == 0:
        return '-'
    if b == 1:
        return '_'
    return '?'

def append3bytes(b1, b2, b3):
    c1 = b1 >> 2
    c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
    c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
    c4 = b3 & 0x3F
    return encode_6bit(c1) + encode_6bit(c2) + encode_6bit(c3) + encode_6bit(c4)

def plantuml_encode(text: str) -> str:
    data = text.encode('utf-8')
    compressor = zlib.compressobj(level=9, method=zlib.DEFLATED, wbits=-15)
    compressed = compressor.compress(data) + compressor.flush()
    res = []
    i = 0
    length = len(compressed)
    while i < length:
        b1 = compressed[i]
        b2 = compressed[i+1] if i+1 < length else 0
        b3 = compressed[i+2] if i+2 < length else 0
        res.append(append3bytes(b1, b2, b3))
        i += 3
    return ''.join(res)

def replace_first_plantuml(md_text: str) -> str:
    pattern = re.compile(r"```plantuml\n(.*?)\n```", re.S)
    m = pattern.search(md_text)
    if not m:
        raise SystemExit('No plantuml block found')
    plantuml_src = m.group(1).strip()
    encoded = plantuml_encode(plantuml_src)
    img_link = f"![KEPLAR diagram]({PLANTUML_SERVER}{encoded})"
    return md_text[:m.start()] + img_link + md_text[m.end():]

def main():
    if len(sys.argv) < 2:
        print('Usage: plantuml_to_img.py <markdown-file>')
        sys.exit(2)
    path = sys.argv[1]
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    try:
        new_text = replace_first_plantuml(text)
    except SystemExit as e:
        print('Error:', e)
        sys.exit(1)
    # backup
    with open(path + '.bak', 'w', encoding='utf-8') as f:
        f.write(text)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Replaced plantuml block and backed up original to', path + '.bak')

if __name__ == '__main__':
    main()
