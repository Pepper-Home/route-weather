module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      hasIdentityEndpoint: !!process.env.IDENTITY_ENDPOINT,
      hasIdentityHeader: !!process.env.IDENTITY_HEADER,
      hasMsiEndpoint: !!process.env.MSI_ENDPOINT,
      hasMsiSecret: !!process.env.MSI_SECRET,
      nodeVersion: process.version,
      identityEndpointValue: process.env.IDENTITY_ENDPOINT?.substring(0, 50) + '...',
      allEnvKeys: Object.keys(process.env).sort()
    })
  };
};
