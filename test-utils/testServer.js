// Starts an Express app on an ephemeral port for a test and tears it down.
// No supertest in this repo: Node's global fetch is enough.
//
//   const srv = await startTestServer(app);
//   const res = await fetch(`${srv.url}/api/features`);
//   await srv.close();

export function startTestServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(done => server.close(() => done())),
      });
    });
    server.on('error', reject);
  });
}
