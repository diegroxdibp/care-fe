// Frontend local contra o backend de staging. O staging só aceita CORS de
// https://staging.careclinica.com, por isso o browser fala apenas com o
// dev-server (mesma origem) e é o proxy que chama o staging.
//
// changeOrigin só reescreve o Host; o browser continua a mandar
// Origin: http://localhost:4200 nos POST, e o Spring rejeita-o com
// 403 "Invalid CORS request". Sem Origin, o pedido deixa de ser CORS.
const STAGING = 'https://api-staging.careclinica.com';

const backend = {
  target: STAGING,
  secure: true,
  changeOrigin: true,
  // Os cookies de sessão do staging não podem ficar presos a um domínio
  // que não seja localhost, senão o browser descarta-os.
  cookieDomainRewrite: { '*': '' },
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    proxy.on('error', (err) => console.error('[proxy error]', err));

    // Disable response buffering so SSE events stream through immediately
    proxy.on('proxyRes', (proxyRes) => {
      if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
        proxyRes.headers['x-accel-buffering'] = 'no';
        proxyRes.headers['cache-control'] = 'no-cache';
      }
    });
  },
};

module.exports = {
  '/api': backend,
  '/oauth2': backend,
  '/login/oauth2': backend,
};
