// server/modules/chat/crisis.ts
// Pure: the fixed crisis notice is sent by the server, never left to the model.
const CRISIS =
  /\b(?:suicide|suicidal|kill\s+myself|end\s+my\s+life|self[\s-]?harm|hurt\s+myself|want\s+to\s+die|overdose)\b/i

export const isCrisis = (text: string) => CRISIS.test(text)
