// WORKED EXAMPLE of a route module. Copy this file to server/routes/<yours>.js,
// rename, and add it to server/routes/index.js (one import, one array entry).
//
// What a module is: a plain object with
//   name        for logs
//   migrations  optional; additive SQLite steps (see server/db/migrate.js)
//   register    called once at boot with the shared context (`ctx`)
//
// Rules of the road:
//  - Put the whole feature behind `requireFeature('<flag>')`. While the flag is
//    off the route answers 404, exactly as if it did not exist.
//  - Use `authMiddleware` for anything user-specific; it sets `req.userId`.
//  - Read and write the database through `ctx.db` (better-sqlite3, synchronous).
//  - Never add inline code to server.js. This registry is the only seam.
//
// This example is intentionally boring. It is gated by the `experimental` flag,
// which the owner turns on for hidden detection behaviours, and it returns
// nothing but the caller's user id and the flag state. Delete it when a real
// module has taken its place as the reference.

export default {
  name: 'example',

  migrations: [
    // { id: 'example_001_create', up: h => h.createTable(`CREATE TABLE IF NOT EXISTS ...`) },
  ],

  register({ app, authMiddleware, requireFeature, flags }) {
    app.get('/api/_example/ping', requireFeature('experimental'), authMiddleware, (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, userId: req.userId, experimental: flags.isOn('experimental') });
    });
  },
};
