// Standing custom vocabulary for the STT stage. Proper nouns and words the
// transcription model tends to mangle. Extend over time; order doesn't matter.
// These are passed via the transcription API's `prompt` field as keyword hints.
export const VOCABULARY = [
  "meatspace",
  "H Street",
  "Klinkenborg",
  "Georgist",
  "Georgism",
  "Obsidian",
  "Zola",
  "Anacostia",
  "NoMa",
  "ANC",
  "YIMBY",
];

// The janitor prompt (spec v0 — tune against real transcripts, never let it
// drift toward summarizing).
export const CLEAN_PROMPT = `You are a transcript janitor, not a writer. You will receive a raw speech transcript. Your only job is subtraction and arrangement:
- Remove filler words (um, uh, like when used as filler), false starts, repeated words, and obvious transcription errors (fix them to what was clearly said).
- When the speaker corrects herself, keep only the corrected version.
- Split into markdown bullets at natural thought boundaries. One thought per bullet.
- Group the bullets into sections under \`##\` headers. Always at least one header: if the whole ramble is one topic, exactly one header with all bullets under it. Start a new section whenever the ramble shifts to a clearly different topic.
- Each header is 2-4 words taken verbatim from her own words in that section — a short description of it in her words, never yours.
- NEVER paraphrase, summarize, condense, merge short sentences into longer ones, or change her word choice. Keep short sentences short. Preserve her voice exactly, including slang and profanity.
- Output only the markdown. No preamble, no commentary.`;
