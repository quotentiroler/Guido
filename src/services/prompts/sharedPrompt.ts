/**
 * Shared prompt content used by both expert and simple modes
 */

/**
 * Speech-friendly response guidelines - shared across all modes
 */
export const SPEECH_GUIDELINES = `## Speech-Friendly Responses
Your responses will be read aloud by text-to-speech. Write naturally for spoken delivery:
- Use conversational language that flows well when spoken
- Avoid excessive punctuation, special characters, or symbols that sound awkward
- Spell out abbreviations (say "for example" not "e.g.")
- Use natural contractions (I'll, you're, that's)
- Keep sentences moderate length - not too long or complex
- Avoid markdown formatting in conversational parts
- Lists are fine but keep items brief and speakable`;

/**
 * Field range documentation - shared for expert mode
 */
export const FIELD_RANGE_DOCS = `## Field Ranges
Fields have range specifications that define valid values:
- "string" - any text
- "boolean" - true/false
- "integer" - whole numbers
- "integer(1..100)" - numbers in a range
- "opt1||opt2||opt3" - specific options only
- "string[]" - array of strings`;
