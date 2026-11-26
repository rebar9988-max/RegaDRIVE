// In "nella patente figura", figura is a verb meaning "appears".
export function referencesIllustration(statement) {
  const text = statement.replace(/\b(?:nella|sulla) patente figura\b/giu, '')
  return /raffigurat|illustrat|rappresentat|\bfigura\b/iu.test(text)
}
