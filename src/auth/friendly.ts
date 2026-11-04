/**
 * Plain-English versions of the errors we expect. Anything else is shown
 * as Supabase wrote it, so setup problems (e.g. a wrong key) aren't hidden.
 */
export function friendly(message: string, step: 'send' | 'verify'): string {
  if (/signups? not allowed|not allowed for otp|user not found/i.test(message)) {
    return "That email isn't on Bella's list yet. Ask a parent to add you."
  }
  if (/rate limit|too many|security purposes/i.test(message)) {
    return 'Too many tries. Please wait a minute and try again.'
  }
  if (step === 'verify' && /token.*(expired|invalid)|otp.*(expired|invalid)/i.test(message)) {
    return "That code didn't work. Check it, or send a new one."
  }
  if (/invalid api key|no api key/i.test(message)) {
    return `The app's Supabase key looks wrong (${message}). Check the VITE_SUPABASE_ANON_KEY secret.`
  }
  return `Couldn't ${step === 'send' ? 'send the code' : 'check the code'}: ${message}`
}
