"""Synthetic fixtures only; no real postings or personal experiences."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "plugins/application-coach/skills/experience-interview/scripts/career_store.py"
spec = importlib.util.spec_from_file_location("career_store", SCRIPT)
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)


def question(**changes):
    row = {
        "company": "가상기업", "role": "AI 엔지니어", "recruitment_cycle": "2026 하반기",
        "posting_date": "2026-09-01", "posting_date_basis": "공식 공고 게시일",
        "posting_date_source_url": "https://example.invalid/jobs/123",
        "posting_summary": "허구 테스트 공고", "source_kind": "posting",
        "recruitment_status": "unknown", "source_site": "허구 테스트 사이트",
        "source_url": "https://example.invalid/jobs/123?utm_source=test",
        "question_text": "어려운 문제를 해결한 경험을 설명하세요.",
        "verification_status": "verified", "evidence_excerpt": "허구 공고: 2026-09-01, AI 엔지니어, 해당 문항",
        "fetched_at": "2026-10-08", "verified_at": "2026-10-08",
        "length_limit": 500, "length_count_mode": "codepoints",
    }
    row.update(changes)
    return row


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "private-data"
        self.app = store.Store(self.root, "2026-10-08")

    def load_one(self, **changes):
        result = self.app.import_batch([question(**changes)], "AI 엔지니어")
        return result["question_ids"][0]

    def test_calendar_window_and_leap_year(self):
        self.assertTrue(store.in_window("2024-10-08", "2026-10-08"))
        self.assertFalse(store.in_window("2024-10-07", "2026-10-08"))
        self.assertFalse(store.in_window("2026-10-09", "2026-10-08"))
        self.assertTrue(store.in_window("2022-02-28", "2024-02-29"))

    def test_unverified_and_unknown_date_rejected_without_writing(self):
        for row in [question(verification_status="unverified"), question(posting_date="unknown"), question(evidence_excerpt=""), question(source_url="file:///secret")]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                self.app.import_batch([row], "AI 엔지니어")
        self.assertFalse((self.root / "catalog.json").exists())

    def test_capacity_and_empty_input(self):
        with self.assertRaises(ValueError):
            self.app.import_batch([], "AI 엔지니어")
        with self.assertRaises(ValueError):
            self.app.import_batch([question(question_text=f"문항 {n}") for n in range(51)], "AI 엔지니어")

    def test_reposts_merge_sources_different_companies_remain(self):
        result = self.app.import_batch([question(), question(source_site="두 번째 사이트", source_url="https://second.invalid/post/456"), question(company="다른 가상기업")], "AI 엔지니어")
        self.assertEqual(len(result["question_ids"]), 2)
        catalog = self.app.read()
        self.assertEqual(len(catalog["questions"][result["question_ids"][0]]["sources"]), 2)
        self.assertEqual(store.canonical_url("https://x.invalid/?jobId=1&utm_campaign=a#top"), "https://x.invalid/?jobId=1")
        self.assertNotEqual(store.canonical_url("https://x.invalid/?jobId=1"), store.canonical_url("https://x.invalid/?jobId=2"))

    def test_reuse_and_explicit_rotation_preserve_history(self):
        qid = self.load_one()
        self.assertEqual(store.Store(self.root, "2026-10-08").next_question("AI 엔지니어")["id"], qid)
        with self.assertRaises(ValueError):
            self.app.import_batch([question(question_text="새 문항")], "AI 엔지니어")
        self.app.import_batch([question(question_text="새 문항")], "AI 엔지니어", replace_remaining="on_hold")
        self.assertEqual(self.app.read()["questions"][qid]["status"], "on_hold")
        self.assertEqual(len(self.app.read()["batches"]), 2)

    def test_completed_not_reintroduced_and_stale_not_suggested(self):
        qid = self.load_one(posting_date="2024-10-08")
        self.assertIsNone(store.Store(self.root, "2026-10-09").next_question("AI 엔지니어"))
        self.app.save_answer(qid, "제가 직접 원인을 확인했습니다.", [{"situation": "허구 상황", "role": "진단 담당", "actions": ["원인 확인"], "result": "오류 감소", "learning": "검증 필요", "evidence": "사용자 진술이라는 허구 테스트", "tags": ["문제 해결"]}])
        result = self.app.import_batch([question(posting_date="2024-10-08")], "AI 엔지니어")
        self.assertEqual(result["question_ids"], [])
        self.assertEqual(self.app.read()["questions"][qid]["status"], "completed")

    def test_checkpoint_and_versioned_answer_exports(self):
        qid = self.load_one()
        self.app.checkpoint(qid, {"user_statements": ["허구 진술"], "summary": "허구 요약", "next_question": "본인 역할은?"})
        self.assertEqual(self.app.read()["questions"][qid]["status"], "in_progress")
        exp = {"situation": "허구", "role": "담당", "actions": ["검증"], "result": "오류 감소", "learning": "관찰", "evidence": "허구 진술", "tags": []}
        saved = self.app.save_answer(qid, "허구 답변", [exp])
        self.app.save_answer(qid, "허구 수정 답변", [dict(exp, id=saved["experience_ids"][0])])
        self.assertTrue((self.root / "answers" / qid / "answer-v002.md").exists())
        self.assertTrue((self.root / "interviews" / f"{qid}.md").exists())
        self.assertEqual(len(self.app.read()["experiences"]), 1)
        self.assertEqual(len(self.app.read()["experiences"][saved["experience_ids"][0]]["revisions"]), 2)

    def test_failed_export_does_not_complete_or_destroy_catalog(self):
        qid = self.load_one()
        before = (self.root / "catalog.json").read_bytes()
        with patch.object(store, "atomic_write", side_effect=OSError("disk full")), self.assertRaises(OSError):
            self.app.save_answer(qid, "허구 답변", [])
        self.assertEqual((self.root / "catalog.json").read_bytes(), before)
        self.assertEqual(self.app.read()["questions"][qid]["status"], "pending")
        self.assertFalse((self.root / ".lock").exists())

    def test_late_write_failure_preserves_existing_experience(self):
        qid = self.load_one()
        exp = {"situation": "허구", "role": "담당", "actions": ["검증"], "result": "변화", "learning": "배움", "evidence": "허구 진술"}
        first = self.app.save_answer(qid, "허구 첫 답변", [exp])
        eid = first["experience_ids"][0]
        before = (self.root / "experiences" / f"{eid}.json").read_bytes()
        original = store.atomic_write
        def fail_late(path, text):
            if Path(path) == self.root / "catalog.json":
                raise OSError("catalog write failed")
            return original(path, text)
        with patch.object(store, "atomic_write", side_effect=fail_late), self.assertRaises(OSError):
            self.app.save_answer(qid, "허구 변경 답변", [dict(exp, id=eid, result="수정된 변화")])
        self.assertEqual((self.root / "experiences" / f"{eid}.json").read_bytes(), before)
        self.assertEqual(len(self.app.read()["answers"][qid]), 1)
    def test_held_work_requires_explicit_resume_and_draft_stays_active(self):
        qid = self.load_one(length_limit=3)
        self.app.set_status(qid, "on_hold")
        with self.assertRaises(ValueError):
            self.app.save_answer(qid, "초안", [], draft=True)
        self.app.set_status(qid, "pending")
        self.app.save_answer(qid, "제한보다 긴 허구 초안", [], draft=True)
        self.assertEqual(self.app.read()["questions"][qid]["status"], "in_progress")
        self.assertFalse(self.app.summary("AI 엔지니어")["needs_new_batch"])

    def test_cli_import_resume_and_character_modes(self):
        source = Path(self.temp.name) / "fixture.json"
        source.write_text(json.dumps([question()], ensure_ascii=False), encoding="utf-8")
        command = [sys.executable, "-X", "utf8", "-B", str(SCRIPT), "--data-dir", str(self.root), "--today", "2026-10-08"]
        imported = subprocess.run(command + ["import-batch", "--scope", "AI 엔지니어", "--input", str(source)], capture_output=True, encoding="utf-8", check=True)
        qid = json.loads(imported.stdout)["question_ids"][0]
        picked = subprocess.run(command + ["next", "--scope", "AI 엔지니어"], capture_output=True, encoding="utf-8", check=True)
        self.assertEqual(json.loads(picked.stdout)["id"], qid)
        self.assertEqual(store.counts("가 😀\n")["codepoints_no_spaces"], 2)
        self.assertEqual(store.counts("가 😀\n")["utf16_no_spaces"], 3)
    def test_invalid_status_path_limit_and_lock(self):
        qid = self.load_one(length_limit=3)
        with self.assertRaises(ValueError):
            self.app.set_status(qid, "completed")
        with self.assertRaises(ValueError):
            self.app.save_answer(qid, "너무 긴 답변입니다", [])
        with self.assertRaises(ValueError):
            self.app.set_status("../../outside", "pending")
        self.root.joinpath(".lock").write_text("busy")
        with self.assertRaises(ValueError):
            self.app.set_status(qid, "discarded")
        repo = Path(self.temp.name) / "repo"
        repo.mkdir()
        repo.joinpath(".git").mkdir()
        with self.assertRaises(ValueError):
            store.Store(repo / "private", "2026-10-08")


if __name__ == "__main__":
    unittest.main()
