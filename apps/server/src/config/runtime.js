/**
 * Holds the objects created at start-up (config + adapters) so services can use
 * them without importing process.env directly. createApp() fills it in; tests
 * build their own runtime with an in-memory mailer and a temp upload folder.
 */
let current = null;

export function setRuntime(value) {
  current = value;
}

export function runtime() {
  if (!current) throw new Error('Runtime has not been initialised. Call createApp(config) first.');
  return current;
}
