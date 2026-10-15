/**
 * Day/week bucketing in src/lib/stats.ts is device-local, so the suite must run in a
 * known timezone or those assertions silently test whatever zone the machine is in.
 * America/Los_Angeles is the strictly harder choice than the app's home zone: it is far
 * from UTC *and* observes DST, so it exercises both failure modes Singapore cannot.
 * Set here rather than at runtime: jest-expo resolves the zone when the test environment
 * is built, so assigning process.env.TZ inside a test has no effect.
 */
module.exports = async () => {
  process.env.TZ = 'America/Los_Angeles';
};
