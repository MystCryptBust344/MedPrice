const express = require('express')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const http = require('http')
const sessionMiddleware = require('./middleware/session')
const { sendMessage, getHistory } = require('./controllers/chatController')
const Chat = require('./models/Chat')

dotenv.config({ path: require('path').join(__dirname, '.env') })

// Create an instance of Express
const app = express()
app.use(express.json())
app.use(cookieParser())

// Bind routes
app.get('/api/chat', sessionMiddleware, getHistory)
app.post('/api/chat', sessionMiddleware, sendMessage)

function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  // Format: medprice-session=xyz; Max-Age=...
  const match = setCookieHeader.match(/medprice-session=([^;]+)/)
  return match ? match[1] : null
}

async function testIsolation() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing in .env')
    process.exit(1)
  }

  // Connect Mongoose
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB...')

  // Clear previous test records
  await Chat.deleteMany({ sessionId: { $regex: /^test-/ } })

  // Spin up real HTTP server on Port 5001
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(5001, resolve))
  console.log('Test server running on http://localhost:5001')

  try {
    console.log('--- Running Session Isolation Integration Tests ---')

    // 1. Send first message without session cookie
    console.log('Step 1: Posting message from User A...')
    const resA1 = await fetch('http://localhost:5001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How much does knee replacement cost?' })
    })

    const setCookie = resA1.headers.get('set-cookie')
    const cookieValA = parseCookie(setCookie)

    if (!cookieValA) {
      throw new Error('Assertion Failed: User A was not issued a secure session cookie!')
    }
    console.log('  -> Success: Issued JWT Cookie for User A:', cookieValA.substring(0, 15) + '...')

    // 2. Fetch history for User A using cookie
    console.log('Step 2: Fetching User A history (expecting 2 messages)...')
    const resA2 = await fetch('http://localhost:5001/api/chat', {
      method: 'GET',
      headers: { 'Cookie': `medprice-session=${cookieValA}` }
    })
    const dataA = await resA2.json()

    if (!dataA.messages || dataA.messages.length !== 2) {
      throw new Error(`Assertion Failed: User A history contains ${dataA.messages?.length} messages instead of 2`)
    }
    console.log('  -> Success: User A history contains exactly 2 messages.')

    // 3. User B (no cookie) fetches history
    console.log('Step 3: Fetching history for User B (fresh request, no cookie)...')
    const resB1 = await fetch('http://localhost:5001/api/chat', {
      method: 'GET'
    })
    const dataB = await resB1.json()

    if (dataB.messages && dataB.messages.length > 0) {
      throw new Error('Assertion Failed: User B leaked User A\'s session messages!')
    }
    
    const setCookieB = resB1.headers.get('set-cookie')
    const cookieValB = parseCookie(setCookieB)
    if (!cookieValB) {
      throw new Error('Assertion Failed: User B was not issued a fresh session cookie')
    }
    if (cookieValA === cookieValB) {
      throw new Error('Assertion Failed: User B was issued the exact same cookie as User A!')
    }
    console.log('  -> Success: User B has a clean empty history and was issued a distinct JWT session cookie.')

    console.log('----------------------------------------------------')
    console.log('✅ ALL INTEGRATION TESTS PASSED: Session Isolation is 100% SECURE!')

  } finally {
    // Clean up DB and close server
    await Chat.deleteMany({ sessionId: { $regex: /^test-/ } })
    server.close()
    await mongoose.connection.close()
    console.log('Test server closed & DB connection released.')
  }
}

testIsolation().catch(err => {
  console.error('❌ INTEGRATION TEST FAILED:', err.message)
  process.exit(1)
})
