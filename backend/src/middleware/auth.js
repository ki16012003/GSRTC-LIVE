const config = require('../config');

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="GSRTC Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  if (user !== config.ADMIN_USER || pass !== config.ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
}

module.exports = { basicAuth };
