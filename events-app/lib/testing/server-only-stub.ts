// Test-only stand-in for the "server-only" package. That package
// throws unconditionally unless resolved under Next's "react-server"
// export condition, which plain Vitest doesn't set — so tests alias it
// here instead of trying to replicate Next's module resolution.
export {};
