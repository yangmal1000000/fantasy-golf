/**
 * Lightweight profanity filter.
 * Blocks common slurs and strong profanity. Replaces with asterisks.
 * Mild words ("damn", "hell") are NOT filtered to keep chat natural.
 */

const BANNED = [
  // strong profanity
  "fuck",
  "shit",
  "cunt",
  "cock",
  "dick",
  "pussy",
  "wanker",
  "twat",
  "bollocks",
  "arsehole",
  // slurs / hate
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "tranny",
  "retard",
  "spastic",
  "paki",
  "kyke",
  "chink",
  "spic",
];

const PATTERN = new RegExp(
  `\\b(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

export function containsProfanity(text: string): boolean {
  return PATTERN.test(text);
}

export function cleanProfanity(text: string): string {
  return text.replace(PATTERN, (match) => {
    let out = match[0];
    for (let i = 1; i < match.length - 1; i++) out += "*";
    out += match[match.length - 1];
    return out;
  });
}
