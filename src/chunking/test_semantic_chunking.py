import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

import numpy as np

SCRIPT = Path(os.environ.get("SEMANTIC_SCRIPT", Path(__file__).with_name("semantic_chunking.py")))
spec = importlib.util.spec_from_file_location("semantic_chunking", SCRIPT)
semantic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(semantic)


class FakeModel:
    def __init__(self, name):
        pass

    def encode(self, sentences, **kwargs):
        return np.tile([1.0, 0.0], (len(sentences), 1))


class SemanticCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.raw = self.root / "raw"
        self.source = self.raw / "Example source"
        self.source.mkdir(parents=True)
        metadata = {"source_id": "SRR_001", "verified": True, "diarization": True,
                    "speaker_map": {"SPEAKER_00": "Rinpoche"}}
        (self.source / "source.json").write_text(json.dumps(metadata))
        self.first = self.source / "a first.json"
        self.selected = self.source / "z selected.json"
        self.write_transcript(self.first, "First transcript.")
        self.write_transcript(self.selected, "Selected transcript.")
        self.output_dir = self.root / "src" / "chunking" / "processed"
        for name, value in [("ROOT", self.root), ("RAW_DIR", self.raw), ("OUT_DIR", self.output_dir)]:
            p = patch.object(semantic, name, value)
            p.start()
            self.addCleanup(p.stop)
        p = patch.dict(sys.modules, {"sentence_transformers": types.SimpleNamespace(SentenceTransformer=FakeModel)})
        p.start()
        self.addCleanup(p.stop)
        self.old_cwd = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.old_cwd)

    def write_transcript(self, path, text):
        path.write_text(json.dumps({"segments": [{"text": text, "start": 0, "end": 5, "speaker": "SPEAKER_00"}]}))

    def run_main(self, value=None, output=None):
        with contextlib.redirect_stdout(io.StringIO()):
            semantic.main(value, output)

    def chunk_speakers(self, speakers, metadata, texts=None):
        self.selected.write_text(json.dumps({"segments": [
            {"start": i * 5, "end": (i + 1) * 5, "speaker": speaker,
             "text": texts[i] if texts else f"Speech number {i}."}
            for i, speaker in enumerate(speakers)
        ]}))
        with contextlib.redirect_stdout(io.StringIO()):
            return semantic.video_passages(FakeModel("test"), self.source, metadata, self.selected)[0]

    def test_all_mapped_speakers_keep_their_labels_and_turns(self):
        rows = self.chunk_speakers(
            ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02", "SPEAKER_01"],
            {"diarization": True, "speaker_map": {
                "SPEAKER_00": "Interviewer", "SPEAKER_01": "Shechen Rabjam Rinpoche",
                "SPEAKER_02": "Translator"}},
        )
        self.assertEqual([r["speaker"] for r in rows],
                         ["Interviewer", "Shechen Rabjam Rinpoche", "Translator", "Shechen Rabjam Rinpoche"])
        self.assertEqual([r["attribution"] for r in rows],
                         ["other_speaker", "rinpoche_own", "other_speaker", "rinpoche_own"])
        self.assertEqual(rows[1]["context_question"], rows[0]["text"])
        self.assertEqual(rows[3]["context_question"], "")
        self.assertEqual([r["original_speaker"] for r in rows],
                         ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02", "SPEAKER_01"])

    def test_mapping_is_read_from_each_source_on_every_run(self):
        for folder, label in [(self.source, "Host"), (self.raw / "Second source", "Rinpoche")]:
            folder.mkdir(exist_ok=True)
            metadata_path = folder / "source.json"
            metadata_path.write_text(json.dumps({"verified": True, "diarization": False,
                                                "speaker_map": {"SPEAKER_00": label}}))
            transcript = folder / "transcript.json"
            self.write_transcript(transcript, "A mapped passage.")
            out = self.root / "mapped.jsonl"
            self.run_main(str(transcript), out)
            self.assertEqual(json.loads(out.read_text())["speaker"], label)
            metadata = json.loads(metadata_path.read_text())
            metadata["speaker_map"]["SPEAKER_00"] = "Updated name"
            metadata_path.write_text(json.dumps(metadata))
            self.run_main(str(transcript), out)
            self.assertEqual(json.loads(out.read_text())["speaker"], "Updated name")

    def test_unmapped_and_missing_speakers_are_not_assumed_to_be_rinpoche(self):
        for diarization in [True, False]:
            rows = self.chunk_speakers(["SPEAKER_00", "SPEAKER_01", None], {"diarization": diarization})
            self.assertEqual(len(rows), 3)
            self.assertTrue(all(r["speaker"] == "Unknown" and r["attribution"] == "unknown" for r in rows))
        rows = self.chunk_speakers(["SPEAKER_00", "SPEAKER_99"],
                                   {"speaker_map": {"SPEAKER_00": "Rinpoche"}})
        self.assertEqual([r["speaker"] for r in rows], ["Rinpoche", "Unknown"])

    def test_identical_display_names_do_not_merge_different_speaker_ids(self):
        rows = self.chunk_speakers(["SPEAKER_00", "SPEAKER_01"],
                                   {"speaker_map": {"SPEAKER_00": "Host", "SPEAKER_01": "Host"}})
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0]["original_speaker"], rows[1]["original_speaker"])

    def test_split_long_segments_keep_mapped_speaker(self):
        rows = self.chunk_speakers(["SPEAKER_02"], {"speaker_map": {"SPEAKER_02": "Translator"}},
                                   ["This is a sentence. " * 150])
        self.assertGreater(len(rows), 1)
        self.assertTrue(all(r["speaker"] == "Translator" and r["original_speaker"] == "SPEAKER_02"
                            and r["attribution"] == "other_speaker" for r in rows))

    def test_invalid_speaker_maps_fail_clearly(self):
        for mapping in [None, [], {"SPEAKER_00": " "}, {"SPEAKER_00": 42}]:
            with self.subTest(mapping=mapping), self.assertRaisesRegex(ValueError, "speaker_map"):
                self.chunk_speakers(["SPEAKER_00"], {"speaker_map": mapping})

    def test_root_relative_and_raw_relative_paths_with_spaces(self):
        self.assertEqual(semantic.resolve_input("raw/Example source/z selected.json"), self.selected)
        self.assertEqual(semantic.resolve_input("Example source/z selected.json"), self.selected)
        self.assertEqual(semantic.resolve_input("Example source"), self.source)

    def test_absolute_and_repo_paths_from_another_directory(self):
        other = self.root / "elsewhere"
        other.mkdir()
        os.chdir(other)
        self.assertEqual(semantic.resolve_input(str(self.selected)), self.selected)
        self.assertEqual(semantic.resolve_input("raw/Example source/z selected.json"), self.selected)
        self.run_main(str(self.selected))
        self.assertTrue(list(self.output_dir.glob("*.jsonl")))
        self.assertFalse((self.root / "processed").exists())
        self.assertFalse((other / "processed").exists())

    def test_explicit_file_wins_over_first_json_and_single_segment_runs(self):
        out = self.root / "custom" / "selected.jsonl"
        self.run_main(str(self.selected), out)
        rows = [json.loads(line) for line in out.read_text().splitlines()]
        self.assertEqual([row["text"] for row in rows], ["Selected transcript."])

    def test_nested_transcript_finds_parent_metadata(self):
        part_dir = self.source / "output_000"
        part_dir.mkdir()
        part = part_dir / "output_000.json"
        self.write_transcript(part, "Part transcript.")
        self.assertEqual(semantic.source_folder(part), self.source)
        out = self.root / "part.jsonl"
        self.run_main(str(part), out)
        self.assertEqual(json.loads(out.read_text())["source_id"], "SRR_001")

    def test_document_and_all_sources(self):
        document = self.raw / "Teaching.txt"
        document.write_text("A document passage.")
        out = self.root / "document.jsonl"
        self.run_main(str(document), out)
        self.assertEqual(json.loads(out.read_text())["source_type"], "document")
        self.assertEqual(json.loads(out.read_text())["attribution"], "unknown")
        self.run_main()
        rows = [json.loads(line) for line in (self.output_dir / "passages_semantic.jsonl").read_text().splitlines()]
        self.assertEqual({row["source_type"] for row in rows}, {"video", "document"})

    def test_invalid_input_paths_fail_clearly(self):
        with self.assertRaisesRegex(ValueError, "Input not found"):
            semantic.resolve_input("missing.json")
        with self.assertRaisesRegex(ValueError, "metadata"):
            semantic.resolve_input(str(self.source / "source.json"))
        loose = self.root / "loose.json"
        self.write_transcript(loose, "No metadata.")
        with self.assertRaisesRegex(ValueError, "No source.json"):
            semantic.source_folder(loose)

    def test_output_cannot_overwrite_inputs(self):
        original = self.selected.read_text()
        with self.assertRaisesRegex(ValueError, "overwrite the input"):
            self.run_main(str(self.selected), self.selected)
        self.assertEqual(self.selected.read_text(), original)
        with self.assertRaisesRegex(ValueError, "overwrite source.json"):
            self.run_main(str(self.selected), self.source / "source.json")


if __name__ == "__main__":
    unittest.main()
