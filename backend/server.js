const express       = require('express')
const path          = require('path')
const cors          = require('cors')
const cookieParser  = require('cookie-parser')
const dotenv        = require('dotenv')
const connectDB     = require('./config/db')
const errorHandler  = require('./middleware/errorhandler')
const sessionMiddleware = require('./middleware/session')

const procedureRoutes = require('./routes/procedureRoutes')
const hospitalRoutes  = require('./routes/hospitalRoutes')
const statsRoutes     = require('./routes/statsRoutes')
const chatRoutes      = require('./routes/chatRoutes')

dotenv.config({ path: path.join(__dirname, '.env') })
const app = express()

// Trust Render's / any reverse-proxy's load-balancer so that
// req.secure and X-Forwarded-Proto are reliable in production.
app.set('trust proxy', 1)

// Build the set of allowed CORS origins:
//  - Always allow localhost / 127.0.0.1 on any port (local dev)
//  - In production, read a comma-separated ALLOWED_ORIGINS env var
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const prodOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server requests (no Origin header) and same-origin requests
    if (!origin) return callback(null, true)
    if (LOCAL_ORIGIN_RE.test(origin)) return callback(null, true)
    if (prodOrigins.includes(origin)) return callback(null, true)
    callback(new Error('CORS: origin not allowed — ' + origin))
  },
  credentials: true   // Required: lets the session cookie travel cross-origin
}))
app.use(express.json())
app.use(cookieParser())


// Redirect .html extensions to clean URLs
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const newPath = req.path.slice(0, -5)
    const qs = req.url.slice(req.path.length)
    return res.redirect(301, newPath + qs)
  }
  next()
})

app.use(express.static(path.join(__dirname, '..', 'frontend')))

// Page routes
app.get('/dashboard', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html')))

app.get('/results', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'results.html')))

app.get('/compare', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'compare.html')))

app.get('/details', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'details.html')))

app.get('/compare-hospitals', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'compare-hospitals.html')))

// API routes — session middleware applied only to /api/chat
app.use('/api/procedures', procedureRoutes)
app.use('/api/hospitals',  hospitalRoutes)
app.use('/api/stats',      statsRoutes)
app.use('/api/chat',       sessionMiddleware, chatRoutes)

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// Catch-all SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'))
  }
})

app.use(errorHandler)

const fs = require('fs')
const https = require('https')

const keyPath = path.join(__dirname, 'config', 'key.pem')
const certPath = path.join(__dirname, 'config', 'cert.pem')

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const credentials = {
    key: fs.readFileSync(keyPath, 'utf8'),
    cert: fs.readFileSync(certPath, 'utf8')
  }
  const secureServer = https.createServer(credentials, app)
  secureServer.listen(5000, () => {
    console.log('Secure HTTPS Server is ON: https://localhost:5000')
  })
} else {
  app.listen(5000, () => {
    console.log('Server is ON http://localhost:5000')
  })
}

connectDB()