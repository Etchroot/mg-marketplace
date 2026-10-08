"""Count the exact style text; does not connect to Suno."""
import argparse
import json
from pathlib import Path


def count_text(text):
    return {
        "codepoints": len(text),
        "utf16": len(text.encode("utf-16-le")) // 2,
    }


def main():
    parser = argparse.ArgumentParser(description="Check a Suno style prompt against a chosen UI limit.")
    parser.add_argument("--style", required=True, type=Path)
    parser.add_argument("--limit", required=True, type=int)
    parser.add_argument("--count-mode", choices=("utf16", "codepoints"), default="utf16")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be a positive integer")
    try:
        # Preserve actual newlines and spaces; ignore only a UTF-8 file BOM.
        text = args.style.read_bytes().decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        parser.error(str(exc))
    counts = count_text(text)
    result = {
        "path": str(args.style),
        "counts": counts,
        "count_mode": args.count_mode,
        "limit": args.limit,
        "within_limit": counts[args.count_mode] <= args.limit,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["within_limit"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
