import hashlib
import json
from pathlib import Path
import re
from argparse import ArgumentParser
import fitz

parser = ArgumentParser(description="Extract the ministry Patenti A/B PDF into a private staging directory.")
parser.add_argument("pdf", type=Path)
parser.add_argument("output", type=Path, help="a new directory outside the repository")
args = parser.parse_args()
pdf = args.pdf
source_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
if source_hash != "fc52aaabda2256eaa711b30a85505316c9f563a9d632d210fa8e0c9aa84bf239":
    parser.error("this extractor expects the September 2026 Italian-language A/B PDF")
out = args.output
repo_root = Path(__file__).resolve().parents[1]
if out.resolve().is_relative_to(repo_root):
    parser.error("staged catalogue and images must stay outside the repository")
out.mkdir()
media = out / "images"
media.mkdir(exist_ok=True)
records = {}
section = None
group = None
images = {}
answers_seen = 0
with fitz.open(pdf) as doc:
    pages = len(doc)
    for page in doc:
        words = page.get_text("words")
        group_titles = {}
        for block in page.get_text("blocks"):
            match = re.match(r"Quesito n° (\d+) - (.*)", block[4], re.S)
            if match:
                group_titles[block[1]] = (int(match[1]), " ".join(match[2].split()))
        ids = [w for w in words if w[0] < 23 and re.fullmatch(r"\d{3,6}", w[4])]
        verdicts = [w for w in words if 354 <= w[0] <= 356 and w[4] in {"VERO", "FALSO"}]
        answers_seen += len(verdicts)
        assert len(ids) == len(verdicts), (page.number, len(ids), len(verdicts))
        boundaries = sorted([w[1] for w in ids] + list(group_titles))
        pictures = [p for p in page.get_image_info(xrefs=True) if p["bbox"][0] > 450]
        for key in ids:
            y = key[1]
            for top in sorted(t for t in group_titles if t < y):
                group, section = group_titles[top]
            verdict, = (w for w in verdicts if abs(w[1] - y) < 1)
            end = next((v for v in boundaries if v > y), page.rect.height)
            prompt_words = sorted(
                (w for w in words if 77 <= w[0] < 354 and y - .2 <= w[1] < end - .2),
                key=lambda w: (round(w[1], 1), w[0]),
            )
            # The Italian PDF starts each prompt at x=77.5. Check the start of each row
            # so a column offset cannot silently clip the first word of every statement.
            if not prompt_words or abs(prompt_words[0][0] - 77.5) > 0.5 or group is None:
                raise ValueError(f"Invalid prompt start on page {page.number + 1}, question {key[4]}")
            prompt = " ".join(w[4] for w in prompt_words)
            associated = [p for p in pictures if y - .2 <= p["bbox"][1] < end - .2]
            assert len(associated) <= 1, (page.number, key[4])
            filename = None
            if associated:
                xref = associated[0]["xref"]
                if xref not in images:
                    image = doc.extract_image(xref)
                    sha = hashlib.sha256(image["image"]).hexdigest()
                    filename = f"{sha}.{image['ext']}"
                    (media / filename).write_bytes(image["image"])
                    images[xref] = filename
                filename = images[xref]
            code = key[4]
            assert code not in records, code
            records[code] = dict(code=code, group=group, topic=section, prompt=prompt,
                                 answer=verdict[4] == "VERO", image=filename, sourcePage=page.number+1)
        if group_titles:
            group, section = group_titles[max(group_titles)]

# Totals for the September 2026 PDF linked in the ministry's 30 October update.
expected = (586, 7020, 715, 3919, 407)
actual = (
    pages, len(records), len({q["group"] for q in records.values()}),
    sum(bool(q["image"]) for q in records.values()), len(set(images.values())),
)
if actual != expected:
    raise SystemExit(f"Unexpected catalogue totals: {actual}; expected {expected}. No catalogue JSON written.")

summary = dict(pages=pages, questions=len(records), answers=answers_seen,
               groups=len({q["group"] for q in records.values()}),
               withImage=sum(bool(q["image"]) for q in records.values()),
               uniqueImages=len(set(images.values())), sha256=source_hash)
(out / "catalogue.json").write_text(json.dumps(dict(country="IT", sourceCatalogue="Patenti A/B",
    status="staged", summary=summary, questions=list(records.values())), ensure_ascii=False, indent=2))
print(summary)
