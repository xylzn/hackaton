from pathlib import Path
import sys
start = int(sys.argv[1])
end = int(sys.argv[2])
lines = Path('server.js').read_text(encoding='utf-8').splitlines()
for idx in range(start-1, min(end, len(lines))):
    print(f"{idx+1}:{lines[idx]}")
