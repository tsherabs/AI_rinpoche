/**
 * Token chunking: transcript.json + source.json -> passages.jsonl
 *
 *   transcript.json : { segments: [{ start, end, speaker, text }, ...] }  (or a bare array)
 *   source.json     : metadata - source_id, title, type, language, date, url,
 *                     speaker_map, verified, permission
 *
 * Every passage gets its metadata from source.json; the transcript only supplies
 * text, timestamps and speaker IDs (mapped to names via source.json -> speaker_map).
 *
 * Speaker handling (both modes in one script):
 *   1. Labelled transcript   -> each speaker ID is mapped through speaker_map
 *                               (unmapped IDs become "Unknown").
 *   2. Unlabelled transcript -> if NO segment has a speaker label (no "speaker 00" /
 *                               "speaker 01" etc.), the whole file is treated as
 *                               spoken by Rinpoche.
 *
 * Install:  npm install js-tiktoken
 * Run:
 *   node chunk_transcript.js                                  # asks for both files
 *   node chunk_transcript.js transcript.json                  # asks only for source.json
 *   node chunk_transcript.js transcript.json source.json      # no questions asked
 *   Options: --output out/passages.jsonl --chunk-tokens 400 --min-tokens 100
 *            --max-tokens 550 --overlap 0
 */

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const readline = require("node:readline/promises");
const { getEncoding } = require("js-tiktoken");

const enc = getEncoding("cl100k_base");

const RINPOCHE_NAMES = new Set(["rinpoche", "shechen rabjam rinpoche"]);
const DEFAULT_SPEAKER = "Shechen Rabjam Rinpoche";
const QUESTION_SPEAKERS = new Set(["host", "interviewer"]);
const MAX_UNIT_WORDS = 40;
const MAX_QUESTION_WORDS = 80;

const cfg = {
  chunkTokens: 300,
  minTokens: 80,
  maxTokens: 450,
  overlapTokens: 40,
};

const TAGS =
  /\[(music|applause|laughter|inaudible|noise)\]|\((music|applause|laughter)\)/gi;
const FILLERS = /\b(um+|uh+|erm|hmm+)\b[,.]?\s*/gi;
const REPEATS = /\b(\w+)(\s+\1\b)+/gi;
const SENTENCE_END = /(?<=[.!?])\s+/;

// ---------- helpers ----------

const countTokens = (t) => enc.encode(t).length;
const wc = (t) => t.split(/\s+/).filter(Boolean).length;
const pad = (n) => String(n).padStart(2, "0");
const hms = (sec) => {
  const s = Math.floor(sec);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const slug = (name) =>
  name
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const clean = (text) =>
  text
    .replace(TAGS, " ")
    .replace(FILLERS, "")
    .replace(REPEATS, "$1")
    .replace(/\s+/g, " ")
    .trim();

function timestampedUrl(url, seconds) {
  if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
    return `${url}${url.includes("?") ? "&" : "?"}t=${Math.floor(seconds)}`;
  }
  return url || "";
}

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${label} is not valid JSON (${file}): ${e.message}`);
  }
}

// ---------- load transcript + source ----------

function loadSegments(file) {
  const data = readJson(file, "Transcript");
  const raw = Array.isArray(data) ? data : data.segments;
  if (!Array.isArray(raw))
    throw new Error(
      "Transcript must be an array or an object with a 'segments' array.",
    );
  return raw
    .map((s) => {
      // Empty / blank / missing speaker labels all count as "no label"
      const label = s.speaker == null ? "" : String(s.speaker).trim();
      return {
        start: Number(s.start),
        end: Number(s.end),
        speaker: label || null,
        text: clean(s.text ?? ""),
      };
    })
    .filter((s) => s.text);
}

/** Read source.json and validate the fields chunking depends on. */
function loadSource(file) {
  const meta = readJson(file, "source.json");
  const smap = meta.speaker_map ?? {};
  if (
    typeof smap !== "object" ||
    Array.isArray(smap) ||
    smap === null ||
    Object.values(smap).some((v) => typeof v !== "string" || !v.trim())
  ) {
    throw new Error(
      "source.json: speaker_map must map speaker IDs to nonempty names.",
    );
  }
  return meta;
}

// ---------- units ----------

function splitByTokens(text, limit) {
  const ids = enc.encode(text);
  const out = [];
  for (let i = 0; i < ids.length; i += limit)
    out.push(enc.decode(ids.slice(i, i + limit)));
  return out;
}

function makeUnits(segments) {
  const units = [];
  const push = (text, start, end) => {
    const tokens = countTokens(text);
    if (tokens <= cfg.maxTokens)
      return units.push({ start, end, text, tokens });
    const pieces = splitByTokens(text, cfg.maxTokens);
    const total = pieces.reduce((a, p) => a + (wc(p) || 1), 0) || 1;
    let t = start;
    for (const p of pieces) {
      const dur = ((end - start) * (wc(p) || 1)) / total;
      units.push({ start: t, end: t + dur, text: p, tokens: countTokens(p) });
      t += dur;
    }
  };

  for (const seg of segments) {
    if (wc(seg.text) <= MAX_UNIT_WORDS) {
      push(seg.text, seg.start, seg.end);
      continue;
    }
    const sentences = seg.text.split(SENTENCE_END).filter((s) => s.trim());
    const total = sentences.reduce((a, s) => a + wc(s), 0) || 1;
    let t = seg.start;
    const span = seg.end - seg.start;
    for (const sentence of sentences) {
      const dur = (span * wc(sentence)) / total;
      push(sentence, t, t + dur);
      t += dur;
    }
  }
  return units;
}

// ---------- token chunking ----------

const tokensIn = (units, s, e) => {
  let n = 0;
  for (let i = s; i <= e; i++) n += units[i].tokens;
  return n;
};

function packRanges(units) {
  const ranges = [];
  let start = 0,
    acc = 0;
  for (let i = 0; i < units.length; i++) {
    if (acc > 0 && acc + units[i].tokens > cfg.chunkTokens) {
      ranges.push([start, i - 1]);
      start = i;
      acc = 0;
    }
    acc += units[i].tokens;
  }
  ranges.push([start, units.length - 1]);
  return ranges;
}

function mergeSmall(units, ranges) {
  ranges = ranges.map((r) => [...r]);
  let changed = true;
  while (changed && ranges.length > 1) {
    changed = false;
    for (let k = 0; k < ranges.length; k++) {
      const [s, e] = ranges[k];
      const size = tokensIn(units, s, e);
      if (size >= cfg.minTokens) continue;
      const options = [];
      if (k > 0) {
        const left = tokensIn(units, ...ranges[k - 1]);
        if (left + size <= cfg.maxTokens)
          options.push({ side: "left", other: left });
      }
      if (k < ranges.length - 1) {
        const right = tokensIn(units, ...ranges[k + 1]);
        if (right + size <= cfg.maxTokens)
          options.push({ side: "right", other: right });
      }
      if (!options.length) continue;
      options.sort((a, b) => a.other - b.other);
      if (options[0].side === "left") {
        ranges[k - 1] = [ranges[k - 1][0], e];
        ranges.splice(k, 1);
      } else {
        ranges[k] = [s, ranges[k + 1][1]];
        ranges.splice(k + 1, 1);
      }
      changed = true;
      break;
    }
  }
  return ranges;
}

function tokenRanges(units) {
  if (!units.length) return [];
  const ranges = mergeSmall(units, packRanges(units));
  return ranges.map(([s, e], k) => {
    let from = s;
    if (k > 0 && cfg.overlapTokens > 0) {
      let ov = 0;
      while (
        from - 1 >= ranges[k - 1][0] &&
        ov + units[from - 1].tokens <= cfg.overlapTokens
      ) {
        ov += units[from - 1].tokens;
        from--;
      }
    }
    return { s, e, from };
  });
}

// ---------- build passages ----------

function buildPassages(segments, meta, fallbackName) {
  const smap = meta.speaker_map ?? {};
  const isMapped = (id) => id !== null && Object.hasOwn(smap, id);

  // MODE 2: no speaker labels anywhere -> the whole file is Rinpoche speaking
  const noSpeakerLabels =
    segments.length > 0 && segments.every((s) => s.speaker === null);

  if (noSpeakerLabels) {
    console.log(
      `note: no speaker labels found; attributing the whole file to ${DEFAULT_SPEAKER}`,
    );
    for (const s of segments) {
      s.original_speaker = null;
      s.speaker = DEFAULT_SPEAKER;
    }
  } else {
    // MODE 1: labelled transcript -> map IDs through speaker_map
    const unmapped = new Set(
      segments
        .filter((s) => !isMapped(s.speaker))
        .map((s) => (s.speaker === null ? "(no label)" : String(s.speaker))),
    );
    if (unmapped.size) {
      console.warn(
        `warning: unmapped speakers [${[...unmapped].sort()}] are labelled Unknown`,
      );
    }

    for (const s of segments) {
      s.original_speaker = s.speaker;
      s.speaker = isMapped(s.original_speaker)
        ? smap[s.original_speaker]
        : "Unknown";
    }
  }

  // One run per speaker turn (diarization IDs stay separate even if names match)
  const runs = [];
  for (const s of segments) {
    const last = runs[runs.length - 1];
    if (last && last.original === s.original_speaker) last.segs.push(s);
    else runs.push({ original: s.original_speaker, segs: [s] });
  }

  // ---- all metadata comes from source.json ----
  const sourceId = meta.source_id || slug(fallbackName);
  const title = meta.title || meta.source || fallbackName;

  const passages = [];
  let secs = 0;
  let question = "";

  for (const { original, segs } of runs) {
    const speaker = segs[0].speaker;
    const name = speaker.trim().toLowerCase();
    const units = makeUnits(segs);
    const attribution = noSpeakerLabels
      ? "rinpoche_own"
      : !isMapped(original) || name === "unknown"
        ? "unknown"
        : RINPOCHE_NAMES.has(name)
          ? "rinpoche_own"
          : "other_speaker";
    const contextQuestion = RINPOCHE_NAMES.has(name) ? question : "";

    secs += units.reduce((a, u) => a + (u.end - u.start), 0);

    for (const { e, from } of tokenRanges(units)) {
      const text = units
        .slice(from, e + 1)
        .map((u) => u.text)
        .join(" ");
      const start = units[from].start;
      const end = units[e].end;
      passages.push({
        passage_id: `${sourceId}_T${String(passages.length + 1).padStart(3, "0")}`,
        source_id: sourceId,
        title,
        source_type: meta.type ?? "video",
        speaker,
        original_speaker: original,
        attribution,
        language: meta.language ?? "English",
        date: meta.date ?? "",
        start: hms(start),
        end: hms(end),
        start_seconds: Math.round(start * 100) / 100,
        url: timestampedUrl(meta.url ?? "", start),
        context_question: contextQuestion,
        text,
        word_count: wc(text),
        token_count: countTokens(text),
        chunking_method: "token",
        review_status: "auto",
      });
    }

    question = QUESTION_SPEAKERS.has(name)
      ? segs
          .map((x) => x.text)
          .join(" ")
          .split(/\s+/)
          .filter(Boolean)
          .slice(-MAX_QUESTION_WORDS)
          .join(" ")
      : "";
  }
  return { passages, secs };
}

// ---------- ask for files ----------

/** Clean a path pasted or dragged into the terminal. */
function normalizePath(input) {
  let p = input
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\ /g, " ");
  if (p.startsWith("~"))
    p = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      p.slice(1),
    );
  return p;
}

async function askForFile(rl, label, defaultPath) {
  while (true) {
    const hint = defaultPath ? ` [Enter = ${defaultPath}]` : "";
    const answer = (await rl.question(`${label}${hint}: `)).trim();
    const chosen = answer ? normalizePath(answer) : defaultPath;
    if (!chosen) {
      console.log(
        "  Please enter a file path (you can drag the file into this window).",
      );
      continue;
    }
    const resolved = path.resolve(chosen);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      console.log(`  File not found: ${resolved}`);
      continue;
    }
    return resolved;
  }
}

// ---------- main ----------

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string" },
      "chunk-tokens": { type: "string" },
      "min-tokens": { type: "string" },
      "max-tokens": { type: "string" },
      overlap: { type: "string" },
    },
  });

  let [transcriptArg, sourceArg] = positionals;
  let transcriptPath = transcriptArg
    ? path.resolve(normalizePath(transcriptArg))
    : null;
  let sourcePath = sourceArg ? path.resolve(normalizePath(sourceArg)) : null;

  // Ask for whatever was not given on the command line
  if (!transcriptPath || !sourcePath) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      if (!transcriptPath)
        transcriptPath = await askForFile(rl, "Path to transcript JSON");
      if (!sourcePath) {
        const beside = path.join(path.dirname(transcriptPath), "source.json");
        sourcePath = await askForFile(
          rl,
          "Path to source JSON (metadata)",
          fs.existsSync(beside) ? beside : null,
        );
      }
    } finally {
      rl.close();
    }
  }

  if (values["chunk-tokens"])
    cfg.chunkTokens = parseInt(values["chunk-tokens"], 10);
  if (values["min-tokens"]) cfg.minTokens = parseInt(values["min-tokens"], 10);
  if (values["max-tokens"]) cfg.maxTokens = parseInt(values["max-tokens"], 10);
  if (values.overlap) cfg.overlapTokens = parseInt(values.overlap, 10);
  if (cfg.maxTokens < cfg.chunkTokens) cfg.maxTokens = cfg.chunkTokens;

  if (path.basename(transcriptPath) === "source.json") {
    throw new Error(
      "The first argument must be the transcript JSON, not source.json.",
    );
  }

  const meta = loadSource(sourcePath);
  if (!meta.verified)
    throw new Error(
      'source.json: not verified (set "verified": true to chunk).',
    );
  if (["no", "pending"].includes(String(meta.permission ?? "").toLowerCase())) {
    throw new Error(`source.json: permission is "${meta.permission}".`);
  }

  const segments = loadSegments(transcriptPath);
  const { passages, secs } = buildPassages(
    segments,
    meta,
    path.basename(transcriptPath, ".json"),
  );

  const output = path.resolve(
    values.output ??
      path.join(
        path.dirname(transcriptPath),
        `${slug(path.basename(transcriptPath, ".json"))}_passages.jsonl`,
      ),
  );
  if (output === transcriptPath || output === sourcePath) {
    throw new Error("Output must not overwrite the transcript or source.json.");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    passages.map((p) => JSON.stringify(p)).join("\n") +
      (passages.length ? "\n" : ""),
    "utf-8",
  );

  const toks = passages.map((p) => p.token_count);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  console.log(
    `source           : ${meta.title || meta.source || "(untitled)"} [${meta.source_id || "no source_id"}]`,
  );
  console.log(`passages         : ${passages.length}`);
  console.log(`total tokens     : ${sum(toks)}`);
  console.log(
    `tokens / passage : min ${toks.length ? Math.min(...toks) : 0}, avg ${toks.length ? Math.floor(sum(toks) / toks.length) : 0}, max ${toks.length ? Math.max(...toks) : 0}`,
  );
  console.log(`included speech  : ${(secs / 3600).toFixed(2)} hours`);
  console.log(`written to       : ${output}`);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
