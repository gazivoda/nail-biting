// GET /api/features: the public feature-flag map.
//
// No auth and no PII: it is the same for every visitor and says only which
// product features the owner has switched on. Every known flag is present as an
// explicit true or false, so the client never has to guess the difference
// between "off" and "unknown". Cached for a minute: flags change only when the
// owner edits FEATURE_FLAGS and restarts the server.

export default {
  name: 'features',
  register({ app, flags }) {
    app.get('/api/features', (_req, res) => {
      res.set('Cache-Control', 'public, max-age=60');
      res.json(flags.all());
    });
  },
};
