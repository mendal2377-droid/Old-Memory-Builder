/**
 * The code for the lighthouse door.
 *
 * This is a door, not a lock. It ships in the client bundle and anyone reading
 * the source can find it, so nothing private should ever sit behind it.
 */
const LIGHTHOUSE_CODE = 'mendal'

export function isLighthouseCode(input: string) {
  return input.trim().toLowerCase() === LIGHTHOUSE_CODE
}
