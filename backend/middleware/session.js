// Session middleware — anonymous JWT via HttpOnly cookie
// Issues a signed JWT on first visit; verifies on subsequent requests.
// The frontend never sees or touches the token — it rides in the cookie jar.

const jwt  = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')

const COOKIE_NAME = 'medprice-session'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000  // 30 days in ms

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set in .env')
  return secret
}

function sessionMiddleware(req, res, next) {
  const secret = getSecret()
  const existing = req.cookies && req.cookies[COOKIE_NAME]

  if (existing) {
    // Verify and decode
    try {
      const decoded = jwt.verify(existing, secret)
      req.sessionId = decoded.sub
      return next()
    } catch (err) {
      // Invalid / tampered token — issue a fresh one
    }
  }

  // Issue a new anonymous session token
  const sessionId = uuidv4()
  const token = jwt.sign({ sub: sessionId }, secret, { expiresIn: '30d' })

  // In production (Render behind TLS termination), we need:
  //   sameSite: 'none' — allows the cookie to cross origins (Vercel → Render)
  //   secure: true     — required by browsers whenever sameSite is 'none'
  // Locally (HTTP, same origin) we use the safer defaults.
  const isProd = process.env.NODE_ENV === 'production'

  res.cookie(COOKIE_NAME, token, {
    httpOnly:  true,
    sameSite:  isProd ? 'none' : 'lax',
    maxAge:    COOKIE_MAX_AGE,
    secure:    isProd
  })

  req.sessionId = sessionId
  next()
}

module.exports = sessionMiddleware
