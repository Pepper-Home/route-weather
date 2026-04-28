module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      hasIdentityEndpoint: !!process.env.IDENTITY_ENDPOINT,
      hasIdentityHeader: !!process.env.IDENTITY_HEADER,
      nodeVersion: process.version,
      identityVars: Object.keys(process.env).filter(k => k.includes('IDENTITY') || k.includes('MSI') || k.includes('AZURE'))
    })
  };
};
