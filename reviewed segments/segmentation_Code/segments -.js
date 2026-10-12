import fs from 'fs' 
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

const fileContent = fs.readFileSync('Rabjam Rinpoche Entering a teacher-student relationship - Dharma Time (480p).json', 'utf-8'); 
const parsedContent = JSON.parse(fileContent); 

const reviwedText = []; 
const speakerLabels = {//Change the labels based on the diarization 
    SPEAKER_00: "Matthuew",
    SPEAKER_01: "Rinpochoe",
    SPEAKER_02: "Audience"
}

for(let i = 0; i < parsedContent.segments.length; i++){
    const segments = parsedContent.segments[i]
    const reviwedSegments = {
        segment_id: `SRR_001_${String(i+0)}`,
        start: segments.start,
        end: segments.end, 
        original_speaker: segments.speaker ?? null, 
        verified_speaker: speakerLabels[segments.speaker] ?? 'unknown', 
        text: segments.text.trim(), 
        include_in_corpus: null, 
        exclusion_reason: null
    }

    reviwedText.push(reviwedSegments)
}

fs.writeFileSync('review.segments.json', JSON.stringify(reviwedText))







