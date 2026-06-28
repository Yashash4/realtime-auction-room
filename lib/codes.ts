import { randomInt } from "crypto";

// Unambiguous alphabet (no 0/O/1/I/L) for human-friendly room codes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genRoomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
