/**
 * fileBridge.ts
 *
 * A module-level store for passing a File object from the landing page
 * to the resizer across client-side navigation (router.push).
 *
 * Why not sessionStorage + blob URL?
 * - Blob URLs can become inaccessible after navigation in some browsers
 * - sessionStorage requires an async re-fetch which can fail silently
 * - This is simpler, synchronous, and 100% reliable within the same tab
 *
 * This module is a singleton in the Next.js client bundle — the same
 * instance is shared between all pages during client-side navigation.
 */

let _pendingFile: File | null = null;

export const fileBridge = {
  set:   (file: File) => { _pendingFile = file; },
  get:   ()           => _pendingFile,
  clear: ()           => { _pendingFile = null; },
  has:   ()           => _pendingFile !== null,
};
