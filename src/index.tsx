/**
 * Library entrypoint — re-exports the public JS wrapper for the native module.
 *
 * Consumers should import from the package root:
 * ```ts
 * import VonageVoice from '@technotoil/vonage-voice';
 * // or
 * import { VonageVoice } from '@technotoil/vonage-voice';
 * ```
 *
 * Keep this file minimal: it merely forwards the default export from
 * `./VonageVoice` so bundlers and packagers resolve the library entry point
 * correctly. Implementation details live in `src/VonageVoice.ts`.
 */

import VonageVoice from './VonageVoice';

// Default export (recommended): `import VonageVoice from '@technotoil/vonage-voice'`
export default VonageVoice;

// Named export (optional): `import { VonageVoice } from '@technotoil/vonage-voice'`
export { VonageVoice };
