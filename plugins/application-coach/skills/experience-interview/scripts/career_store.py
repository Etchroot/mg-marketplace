"""Private, file-based application records. No network calls or automatic scraping."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import uuid


STATUSES = {"pending", "in_progress", "completed", "on_hold", "discarded"}
COUNT_MODES = {"codepoints", "utf16", "codepoints_no_spaces", "utf16_no_spaces"}


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def in_window(posting_date, today):
    end = date.fromisoformat(today)
    try:
        start = end.replace(year=end.year - 2)
    except ValueError:
        start = end.replace(year=end.year - 2, day=28)
    return start <= date.fromisoformat(posting_date) <= end


def canonical_url(value):
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password:
        raise ValueError("Source must be an HTTP(S) URL without credentials")
    pairs = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid"}]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", urlencode(sorted(pairs)), ""))


def identifier(parts):
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode("utf-8")).hexdigest()[:24]


def counts(text):
    compact = re.sub(r"\s", "", text)
    return {"codepoints": len(text), "utf16": len(text.encode("utf-16-le")) // 2,
            "codepoints_no_spaces": len(compact), "utf16_no_spaces": len(compact.encode("utf-16-le")) // 2}


def atomic_write(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".writing-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


_restore_write = atomic_write


def json_text(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


class Store:
    def __init__(self, root, today=None):
        self.root = Path(root).expanduser().resolve()
        self.today = today or datetime.now().astimezone().date().isoformat()
        date.fromisoformat(self.today)
        if any((parent / ".git").exists() for parent in [self.root, *self.root.parents]):
            raise ValueError("Personal data must be outside every Git checkout")

    def read(self):
        path = self.root / "catalog.json"
        if not path.exists():
            return {"schema_version": 1, "questions": {}, "batches": [], "interviews": {}, "answers": {}, "experiences": {}}
        catalog = json.loads(path.read_text(encoding="utf-8-sig"))
        if catalog.get("schema_version") != 1 or any(k not in catalog for k in ("questions", "batches", "interviews", "answers", "experiences")):
            raise ValueError("Unsupported or incomplete catalog; preserve it and recover from backup")
        return catalog

    @contextmanager
    def transaction(self):
        self.root.mkdir(parents=True, exist_ok=True)
        lock = self.root / ".lock"
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            raise ValueError("Another operation holds .lock; verify that it stopped before removing the lock") from None
        os.close(fd)
        self._snapshots = {}
        try:
            catalog = self.read()
            yield catalog
            atomic_write(self.root / "catalog.json", json_text(catalog))
        except BaseException:
            # Restore already written exports if the final catalog or another export fails.
            for path, previous in reversed(list(self._snapshots.items())):
                if previous is None:
                    path.unlink(missing_ok=True)
                else:
                    _restore_write(path, previous.decode("utf-8"))
            raise
        finally:
            self._snapshots = {}
            lock.unlink(missing_ok=True)

    def export(self, path, text):
        path = Path(path)
        if path not in self._snapshots:
            self._snapshots[path] = path.read_bytes() if path.exists() else None
        atomic_write(path, text)

    def validate_question(self, row):
        required = ("company", "role", "posting_date", "posting_date_basis", "posting_date_source_url",
                    "posting_summary", "source_site", "source_url", "question_text", "evidence_excerpt", "fetched_at", "verified_at")
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) or not row[k].strip() for k in required):
            raise ValueError("Question is missing a required nonempty source/date/company/role/evidence field")
        if row.get("verification_status") != "verified" or row.get("source_kind") not in {"posting", "historical_posting", "example_linked_to_posting"}:
            raise ValueError("Only verified posting-linked questions may enter a batch")
        if not in_window(row["posting_date"], self.today):
            raise ValueError("Posting date is outside the rolling two-calendar-year window")
        for key in ("fetched_at", "verified_at"):
            value = date.fromisoformat(row[key])
            if value > date.fromisoformat(self.today) or value < date.fromisoformat(row["posting_date"]):
                raise ValueError("Fetch/verification dates must be between posting date and request date")
        canonical_url(row["posting_date_source_url"])
        canonical = canonical_url(row["source_url"])
        if row.get("recruitment_status", "unknown") not in {"open", "closed", "unknown"}:
            raise ValueError("Recruitment status must be open, closed or unknown")
        limit = row.get("length_limit")
        if limit is not None and (type(limit) is not int or limit < 1):
            raise ValueError("Length limit must be a positive integer or null")
        mode = row.get("length_count_mode")
        if mode is not None and mode not in COUNT_MODES:
            raise ValueError("Unsupported character count mode")
        clean = dict(row)
        clean.update(canonical_url=canonical, id=identifier([normalized(row["company"]), normalized(row["role"]),
                     normalized(row.get("recruitment_cycle", "")), row["posting_date"], normalized(row["question_text"])]))
        clean["topic_key"] = identifier([normalized(row["question_text"])])
        return clean

    def scoped_ids(self, catalog, scope):
        ids = []
        for batch in reversed(catalog["batches"]):
            if normalized(batch["scope"]) == normalized(scope):
                ids.extend(batch["question_ids"])
        return list(dict.fromkeys(ids))

    def eligible(self, question):
        return in_window(question["posting_date"], self.today) and question["verification_status"] == "verified"

    def import_batch(self, rows, scope, replace_remaining=None):
        if not isinstance(rows, list) or not 1 <= len(rows) <= 50 or not isinstance(scope, str) or not scope.strip():
            raise ValueError("Provide a nonempty scope and 1 to 50 question records")
        if replace_remaining not in {None, "on_hold", "discarded"}:
            raise ValueError("Replacement must hold or discard remaining questions")
        cleaned = [self.validate_question(row) for row in rows]
        with self.transaction() as catalog:
            remaining = [qid for qid in self.scoped_ids(catalog, scope)
                         if catalog["questions"][qid]["status"] in {"pending", "in_progress"} and self.eligible(catalog["questions"][qid])]
            if remaining and replace_remaining is None:
                raise ValueError("Reuse the saved batch first; replacement requires the user's explicit request")
            batch_id = "b-" + uuid.uuid4().hex[:16]
            question_ids = []
            for row in cleaned:
                qid = row["id"]
                source = {k: row.get(k) for k in ("source_site", "source_url", "canonical_url", "source_kind", "posting_date_basis",
                          "posting_date_source_url", "evidence_excerpt", "fetched_at", "verified_at")}
                if qid in catalog["questions"]:
                    old = catalog["questions"][qid]
                    if all(s["canonical_url"] != source["canonical_url"] for s in old["sources"]):
                        old["sources"].append(source)
                    # A repeated source never resets completed, held or discarded work.
                    continue
                row.update(status="pending", sources=[source], status_history=[{"date": self.today, "status": "pending"}])
                catalog["questions"][qid] = row
                question_ids.append(qid)
            if question_ids:
                for qid in remaining:
                    if replace_remaining:
                        self.change_status(catalog["questions"][qid], replace_remaining)
                batch = {"id": batch_id, "scope": scope, "created_at": self.today, "target": 50,
                         "actual": len(question_ids), "question_ids": question_ids}
                catalog["batches"].append(batch)
                self.export(self.root / "batches" / f"{batch_id}.json", json_text(batch))
            return {"batch_id": batch_id if question_ids else None, "question_ids": question_ids,
                    "actual": len(question_ids), "target": 50, "duplicates": len(rows) - len(question_ids)}

    def next_question(self, scope, company=None):
        catalog = self.read()
        choices = [catalog["questions"][qid] for qid in self.scoped_ids(catalog, scope)
                   if catalog["questions"][qid]["status"] in {"pending", "in_progress"} and self.eligible(catalog["questions"][qid])
                   and (not company or normalized(company) in normalized(catalog["questions"][qid]["company"]))]
        choices.sort(key=lambda q: (q["status"] != "in_progress", q.get("recruitment_status") != "open", q["source_kind"] == "example_linked_to_posting"))
        if not choices:
            return None
        result = dict(choices[0])
        result["interview"] = catalog["interviews"].get(result["id"])
        result["previous_answers"] = catalog["answers"].get(result["id"], [])
        return result

    def get_question(self, catalog, qid):
        if qid not in catalog["questions"]:
            raise ValueError("Unknown question ID")
        return catalog["questions"][qid]

    def change_status(self, question, status):
        question["status"] = status
        question["status_history"].append({"date": self.today, "status": status})

    def set_status(self, qid, status):
        if status not in STATUSES - {"completed"}:
            raise ValueError("Use save-answer to complete; status must be pending, in_progress, on_hold or discarded")
        with self.transaction() as catalog:
            self.change_status(self.get_question(catalog, qid), status)
        return {"id": qid, "status": status}

    def checkpoint(self, qid, interview):
        if not isinstance(interview, dict) or not isinstance(interview.get("summary"), str) or not isinstance(interview.get("user_statements"), list):
            raise ValueError("Interview needs summary and user_statements; separate assumptions from user statements")
        with self.transaction() as catalog:
            question = self.get_question(catalog, qid)
            if question["status"] not in {"pending", "in_progress"}:
                raise ValueError("Explicitly resume held/discarded/completed questions before interviewing")
            saved = dict(interview, question_id=qid, updated_at=self.today)
            catalog["interviews"][qid] = saved
            self.export(self.root / "interviews" / f"{qid}.md", "# 인터뷰 기록\n\n```json\n" + json_text(saved) + "```\n")
            self.change_status(question, "in_progress")
        return {"id": qid, "path": str(self.root / "interviews" / f"{qid}.md")}

    def save_answer(self, qid, text, experiences, draft=False):
        if not isinstance(text, str) or not text.strip() or not isinstance(experiences, list):
            raise ValueError("Provide answer text and an experiences array")
        with self.transaction() as catalog:
            question = self.get_question(catalog, qid)
            if question["status"] in {"on_hold", "discarded"}:
                raise ValueError("Explicitly resume held or discarded work before saving an answer")
            measured = counts(text)
            mode = question.get("length_count_mode") or "utf16"
            limit = question.get("length_limit")
            if not draft and limit is not None and measured[mode] > limit:
                raise ValueError("Answer exceeds the confirmed or conservative UTF-16 character limit")
            experience_ids = []
            for item in experiences:
                if not isinstance(item, dict) or any(not item.get(k) for k in ("situation", "role", "actions", "result", "learning", "evidence")):
                    raise ValueError("Experience needs situation, role, actions, result, learning and user evidence")
                eid = item.get("id") or "e-" + uuid.uuid4().hex[:16]
                if item.get("id") and eid not in catalog["experiences"]:
                    raise ValueError("Unknown experience ID; omit id for a new experience")
                if not re.fullmatch(r"e-[a-f0-9]{16}", eid):
                    raise ValueError("Invalid experience ID")
                old = catalog["experiences"].get(eid, {"id": eid, "revisions": [], "question_ids": []})
                old["revisions"].append(dict(item, date=self.today))
                if qid not in old["question_ids"]:
                    old["question_ids"].append(qid)
                catalog["experiences"][eid] = old
                experience_ids.append(eid)
            previous = catalog["answers"].setdefault(qid, [])
            version = len(previous) + 1
            filename = ("draft" if draft else "answer") + f"-v{version:03d}.md"
            path = self.root / "answers" / qid / filename
            answer = {"version": version, "date": self.today, "text": text, "counts": measured,
                      "count_mode": question.get("length_count_mode"), "limit": limit, "draft": draft,
                      "experience_ids": experience_ids, "path": str(path.relative_to(self.root))}
            previous.append(answer)
            document = f"# {question['company']} — {question['role']}\n\n공고 날짜: {question['posting_date']}\n\n문항: {question['question_text']}\n\n"
            document += "## 출처\n\n" + "\n".join(f"- {s['source_site']}: {s['source_url']}" for s in question["sources"])
            document += "\n\n## " + ("초안" if draft else "답변") + "\n\n" + text + "\n\n## 저장 정보\n\n```json\n" + json_text({k: v for k, v in answer.items() if k != "text"}) + "```\n"
            self.export(path, document)
            for eid in experience_ids:
                exp = catalog["experiences"][eid]
                self.export(self.root / "experiences" / f"{eid}.json", json_text(exp))
                self.export(self.root / "experiences" / f"{eid}.md", "# 경험 기록\n\n```json\n" + json_text(exp) + "```\n")
            self.change_status(question, "in_progress" if draft else "completed")
        return {"id": qid, "version": version, "path": str(path), "experience_ids": experience_ids, "counts": measured,
                "status": "in_progress" if draft else "completed"}

    def summary(self, scope):
        catalog = self.read()
        rows = [catalog["questions"][qid] for qid in self.scoped_ids(catalog, scope)]
        actionable = sum(q["status"] in {"pending", "in_progress"} and self.eligible(q) for q in rows)
        return {"scope": scope, "today": self.today, "statuses": {s: sum(q["status"] == s for q in rows) for s in sorted(STATUSES)},
                "actionable": actionable, "needs_new_batch": actionable == 0, "experiences": len(catalog["experiences"]),
                "batches": [b for b in catalog["batches"] if normalized(b["scope"]) == normalized(scope)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path, help="Private directory outside any Git checkout")
    parser.add_argument("--today", help="User's local YYYY-MM-DD date; pass explicitly for correct two-year checks")
    commands = parser.add_subparsers(dest="command", required=True)
    load = commands.add_parser("import-batch")
    load.add_argument("--input", required=True, type=Path)
    load.add_argument("--scope", required=True)
    load.add_argument("--replace-remaining", choices=["on_hold", "discarded"])
    pick = commands.add_parser("next")
    pick.add_argument("--scope", required=True)
    pick.add_argument("--company")
    summary = commands.add_parser("summary")
    summary.add_argument("--scope", required=True)
    status = commands.add_parser("status")
    status.add_argument("--id", required=True)
    status.add_argument("--value", required=True, choices=sorted(STATUSES - {"completed"}))
    checkpoint = commands.add_parser("checkpoint")
    checkpoint.add_argument("--id", required=True)
    checkpoint.add_argument("--input", required=True, type=Path)
    save = commands.add_parser("save-answer")
    save.add_argument("--id", required=True)
    save.add_argument("--answer", required=True, type=Path)
    save.add_argument("--experiences", required=True, type=Path)
    save.add_argument("--draft", action="store_true")
    args = parser.parse_args()
    try:
        store = Store(args.data_dir, args.today)
        if args.command == "import-batch":
            result = store.import_batch(json.loads(args.input.read_text(encoding="utf-8-sig")), args.scope, args.replace_remaining)
        elif args.command == "next":
            result = store.next_question(args.scope, args.company)
        elif args.command == "summary":
            result = store.summary(args.scope)
        elif args.command == "status":
            result = store.set_status(args.id, args.value)
        elif args.command == "checkpoint":
            result = store.checkpoint(args.id, json.loads(args.input.read_text(encoding="utf-8-sig")))
        else:
            result = store.save_answer(args.id, args.answer.read_bytes().decode("utf-8-sig"),
                                      json.loads(args.experiences.read_text(encoding="utf-8-sig")), args.draft)
        print(json_text(result), end="")
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
