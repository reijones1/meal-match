// Excludes visually/verbally ambiguous characters (0/O, 1/I/L) so codes are easy
// to read aloud or type correctly.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 5

export function generateRoomCode() {
  const randomValues = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
  let code = ''
  for (const value of randomValues) {
    code += ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]
  }
  return code
}
