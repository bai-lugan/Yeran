"""Generate a small interface-only Traditional Chinese character map on Windows."""
import ctypes
import json
import re
from pathlib import Path
source = ''.join(path.read_text(encoding='utf-8') for path in Path('src').rglob('*') if path.suffix in ('.ts', '.vue'))
chars = ''.join(sorted(set(re.findall('[\u3400-\u9fff]', source))))
convert = ctypes.windll.kernel32.LCMapStringEx
convert.argtypes = [ctypes.c_wchar_p, ctypes.c_uint, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ssize_t]
convert.restype = ctypes.c_int
buffer = ctypes.create_unicode_buffer(len(chars) * 2 + 1)
count = convert('zh-TW', 0x04000000, chars, len(chars), buffer, len(buffer), None, None, 0)
if count != len(chars):
    raise RuntimeError(f'Unexpected Windows NLS mapping length: {count}')
mapping = {a: b for a, b in zip(chars, buffer[:count]) if a != b}
target = Path('src/hant-map.json')
output = json.dumps(mapping, ensure_ascii=False, separators=(',', ':'))
if not target.exists() or target.read_text(encoding='utf-8') != output:
    target.write_text(output, encoding='utf-8')
print(f'Generated {len(mapping)} interface character mappings.')
