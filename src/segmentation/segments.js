import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../../', import.meta.url));
const rawDir = path.resolve(process.argv[2] ?? path.join(projectDir, 'raw'));
const reviewDir = path.resolve(process.argv[3] ?? path.join(projectDir, 'review'));

// Speaker numbers have different meanings in different recordings.
const speakerLabelsBySource = {
    SRR_001: {
        SPEAKER_00: 'rinpoche',
        SPEAKER_01: 'translator'
    }
};

const sourceFolders = fs.readdirSync(rawDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

const outputs = [];
const segmentIds = new Set();

for (const folder of sourceFolders) {
    const sourceDir = path.join(rawDir, folder);
    const metadata = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source.json'), 'utf8'));
    if (!/^SRR_\d{3,}$/.test(metadata?.source_id ?? '')) {
        throw new Error(`Missing or invalid source_id in ${folder}/source.json`);
    }
    const speakerLabels = speakerLabelsBySource[metadata.source_id] ?? {};
    const transcriptFiles = fs.readdirSync(sourceDir, { recursive: true })
        .filter(file => file.endsWith('.json') && path.basename(file) !== 'source.json')
        .sort();

    for (const file of transcriptFiles) {
        const inputPath = path.join(sourceDir, file);
        const parsedContent = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        if (!Array.isArray(parsedContent?.segments)) {
            throw new Error(`Missing segments array: ${inputPath}`);
        }

        // Existing split recordings use filenames output_000.json, output_001.json, etc.
        const partMatch = /^output_(\d+)$/.exec(path.basename(file, '.json'));
        const partId = partMatch ? `P${partMatch[1]}` : null;
        const prefix = partId ? `${metadata.source_id}_${partId}` : metadata.source_id;
        const reviewedText = [];

        for (let i = 0; i < parsedContent.segments.length; i++) {
            const segment = parsedContent.segments[i];
            if (!segment || typeof segment.text !== 'string' ||
                !Number.isFinite(segment.start) || !Number.isFinite(segment.end) ||
                segment.start < 0 || segment.end < segment.start) {
                throw new Error(`Invalid text or timestamps in ${inputPath}, segment ${i}`);
            }
            const segmentId = `${prefix}_${i}`;
            if (segmentIds.has(segmentId)) throw new Error(`Duplicate segment ID: ${segmentId}`);
            segmentIds.add(segmentId);

            reviewedText.push({
                source_id: metadata.source_id,
                part_id: partId,
                segment_id: segmentId,
                start: segment.start,
                end: segment.end,
                original_speaker: segment.speaker ?? null,
                verified_speaker: Object.hasOwn(speakerLabels, segment.speaker)
                    ? speakerLabels[segment.speaker] : 'unknown',
                text: segment.text.trim(),
                include_in_corpus: null,
                exclusion_reason: null
            });
        }

        const outputPath = path.join(reviewDir, metadata.source_id, file.replace(/\.json$/, '.segments.json'));
        outputs.push({ outputPath, reviewedText, speakerLabels });
    }
}

// Refresh mapped speakers while preserving manual corrections and review decisions.
for (const output of outputs) {
    if (!fs.existsSync(output.outputPath)) continue;
    const existing = JSON.parse(fs.readFileSync(output.outputPath, 'utf8'));
    if (!Array.isArray(existing) || existing.length !== output.reviewedText.length) {
        throw new Error(`Segment structure changed: ${output.outputPath}. Use a new output directory.`);
    }
    const existingById = new Map(existing.map(segment => [segment?.segment_id, segment]));
    if (existingById.size !== existing.length) {
        throw new Error(`Duplicate segment IDs in ${output.outputPath}`);
    }
    output.reviewedText = output.reviewedText.map(segment => {
        const previous = existingById.get(segment.segment_id);
        const identityFields = ['source_id', 'part_id', 'start', 'end', 'original_speaker'];
        if (!previous || identityFields.some(field => previous[field] !== segment[field])) {
            throw new Error(`Segment structure changed: ${segment.segment_id}. Use a new output directory.`);
        }
        return {
            ...segment,
            ...previous,
            verified_speaker: Object.hasOwn(output.speakerLabels, segment.original_speaker)
                ? segment.verified_speaker : previous.verified_speaker
        };
    });
}

for (const { outputPath, reviewedText } of outputs) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(reviewedText, null, 2) + '\n');
    console.log(`${reviewedText.length} segments -> ${outputPath}`);
}

console.log(`Saved ${outputs.length} review files with ${segmentIds.size} segments.`);
