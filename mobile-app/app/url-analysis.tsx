/**
 * AEGIS URL Analysis Route
 * Receives the intercepted URL via search params and renders the analysis screen
 *
 * Invoked by:
 * - Android intent filter (deep link: aegis://analyze?url=...)
 * - Internal navigation: router.push('/url-analysis?url=...')
 */

export { default } from '@/screens/UrlAnalysisScreen';
