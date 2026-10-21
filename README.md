
### Transcription Metadata JSON Schema

```json
{
  "type": "object",
  "properties": {
    "source_id": {
      "type": "string" 
    }, 
    "source": {
      "type": "string"
    },
    "language": {
      "type": "string"
    },
    "duration": {
      "type": "string",
      "format": "hours-min-sec"
    },
    "model": {
      "enum": [
        "whisper-small",
        "whisper-large-v3"
      ]
    },
    "diarization": {
      "type": "boolean"
    },
    "url": {
      "type": "string"
    }, 
    "verified": {
      "type": "boolean"
    }
    "speaker_map":{
      "type": "object", 
      "SPEAKER_N": {
        "type": "string", 
        "enum": ["Shechen Rabjam Rinpoche", "Translator", "Interviewer"]
      }
    }
  }
}
```