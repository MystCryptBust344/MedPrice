/**
 * test-multi-chat.js
 * Integration tests for the multi-thread chat system.
 *
 * Tests:
 *  1. Create 3 threads for User A — verify thread isolation
 *  2. Fetch and verify thread history
 *  3. Verify User B cannot access User A's threads (ownership check)
 *  4. Verify title generation fires only once (idempotency)
 *  5. Verify GET /api/chat/threads returns no messages field (projection)
 *  6. Rename and delete threads
 */

const express      = require('express')
const cookieParser = require('cookie-parser')
const mongoose     = require('mongoose')
const dotenv       = require('dotenv')
const http         = require('http')
const path         = require('path')

dotenv.config({ path: path.join(__dirname, '.env') })

const sessionMiddleware = require('./middleware/session')
const chatRoutes        = require('./routes/chatRoutes')
const Chat              = require('./models/Chat')

// ── Setup app ─────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/api/chat', sessionMiddleware, chatRoutes)

// ── Cookie helpers ────────────────────────────────────────────────────────────
function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  const match = (Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader)
    .match(/medprice-session=([^;]+)/)
  return match ? match[1] : null
}

function cookieHeader(val) {
  return val ? { 'Cookie': `medprice-session=${val}` } : {}
}

// ── Test helper ───────────────────────────────────────────────────────────────
let pass = 0, fail = 0
function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`)
    pass++
  } else {
    console.error(`  ❌ FAIL: ${label}`)
    fail++
  }
}

// ── Main test runner ──────────────────────────────────────────────────────────
async function runTests() {
  if (!process.env.MONGO_URI) { console.error('MONGO_URI missing'); process.exit(1) }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  // Clean up any leftover test threads
  await Chat.deleteMany({ sessionId: /^test-multi-/ })

  const server = http.createServer(app)
  await new Promise(r => server.listen(5002, r))
  console.log('Test server running on http://localhost:5002\n')

  let cookieA, cookieB
  let threadIds = []

  try {

    // ── Test 1: User A gets a session cookie ──────────────────────────────────
    console.log('── Test 1: User A session issuance ──')
    const r1 = await fetch('http://localhost:5002/api/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    cookieA = parseCookie(r1.headers.get('set-cookie'))
    assert(r1.status === 201, `POST /threads returns 201`)
    assert(!!cookieA, `User A issued a session cookie`)
    const t1 = await r1.json()
    threadIds.push(t1.threadId)
    assert(!!t1.threadId, `Thread 1 has a threadId: ${t1.threadId?.slice(0,8)}…`)

    // ── Test 2: Create 2 more threads for User A ──────────────────────────────
    console.log('\n── Test 2: Create 3 total threads for User A ──')
    for (let i = 0; i < 2; i++) {
      const r = await fetch('http://localhost:5002/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cookieHeader(cookieA) }
      })
      const t = await r.json()
      threadIds.push(t.threadId)
    }
    const listRes = await fetch('http://localhost:5002/api/chat/threads', { headers: cookieHeader(cookieA) })
    const listData = await listRes.json()
    assert(listData.threads.length === 3, `User A has 3 threads`)

    // ── Test 3: GET /threads projection — no messages field ───────────────────
    console.log('\n── Test 3: Sidebar projection (no messages in thread list) ──')
    assert(
      listData.threads.every(t => t.messages === undefined),
      `None of the 3 thread list items contain a "messages" field`
    )

    // ── Test 4: Send message to thread 1 ─────────────────────────────────────
    console.log('\n── Test 4: Send message to thread 1 ──')
    const sendRes = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[0]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieHeader(cookieA) },
      body: JSON.stringify({ message: 'How much does knee replacement cost?' })
    })
    assert(sendRes.status === 200, `POST to thread 1 returns 200`)
    const sendData = await sendRes.json()
    assert(typeof sendData.reply === 'string' && sendData.reply.length > 0, `Got an AI reply`)
    assert(sendData.isFirstMessage === true, `isFirstMessage flag is true for first send`)

    // ── Test 5: Thread history fetch ──────────────────────────────────────────
    console.log('\n── Test 5: Fetch thread 1 history ──')
    const histRes = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[0]}`, {
      headers: cookieHeader(cookieA)
    })
    const histData = await histRes.json()
    assert(histData.messages.length === 2, `Thread 1 has exactly 2 messages after one exchange`)
    assert(histData.messages[0].role === 'user',      `First message role is "user"`)
    assert(histData.messages[1].role === 'assistant', `Second message role is "assistant"`)

    // ── Test 6: Second message — isFirstMessage must be false ─────────────────
    console.log('\n── Test 6: isFirstMessage idempotency (race-condition guard) ──')
    const send2Res = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[0]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieHeader(cookieA) },
      body: JSON.stringify({ message: 'Which is the cheapest hospital?' })
    })
    const send2Data = await send2Res.json()
    assert(send2Data.isFirstMessage === false, `isFirstMessage is false on second message (title generation won't fire again)`)

    // ── Test 7: User B cannot access User A's threads ─────────────────────────
    console.log('\n── Test 7: Cross-user isolation (User B cannot access User A threads) ──')
    // Get User B's cookie
    const rb1 = await fetch('http://localhost:5002/api/chat/threads')
    cookieB = parseCookie(rb1.headers.get('set-cookie'))
    assert(!!cookieB, `User B issued a distinct session cookie`)
    assert(cookieA !== cookieB, `User A and B have different cookies`)

    // Try to access User A's thread 1 as User B
    const intrudeRes = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[0]}`, {
      headers: cookieHeader(cookieB)
    })
    assert(intrudeRes.status === 404, `User B gets 404 when trying to access User A's thread`)

    // Try to send a message to User A's thread as User B
    const intrudeSend = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[0]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieHeader(cookieB) },
      body: JSON.stringify({ message: 'I should not be allowed here' })
    })
    assert(intrudeSend.status === 404, `User B gets 404 when trying to POST to User A's thread`)

    // ── Test 8: Rename a thread ───────────────────────────────────────────────
    console.log('\n── Test 8: Rename thread ──')
    const renameRes = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[1]}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...cookieHeader(cookieA) },
      body: JSON.stringify({ title: 'My Heart Surgery Questions' })
    })
    assert(renameRes.status === 200, `PATCH /threads/:id returns 200`)
    const renameData = await renameRes.json()
    assert(renameData.title === 'My Heart Surgery Questions', `Thread title updated correctly`)

    // ── Test 9: Delete a thread ───────────────────────────────────────────────
    console.log('\n── Test 9: Delete thread ──')
    const delRes = await fetch(`http://localhost:5002/api/chat/threads/${threadIds[2]}`, {
      method: 'DELETE',
      headers: cookieHeader(cookieA)
    })
    assert(delRes.status === 200, `DELETE /threads/:id returns 200`)
    const listAfterDel = await (await fetch('http://localhost:5002/api/chat/threads', { headers: cookieHeader(cookieA) })).json()
    assert(listAfterDel.threads.length === 2, `User A has 2 threads after deleting one`)
    assert(
      listAfterDel.threads.every(t => t.threadId !== threadIds[2]),
      `Deleted thread no longer appears in the list`
    )

    // ── Test 10: Backward-compat GET /api/chat ────────────────────────────────
    console.log('\n── Test 10: Backward-compat GET /api/chat ──')
    const legacyGet = await fetch('http://localhost:5002/api/chat', { headers: cookieHeader(cookieA) })
    assert(legacyGet.status === 200, `Legacy GET /api/chat still returns 200`)
    const legacyData = await legacyGet.json()
    assert(Array.isArray(legacyData.messages), `Legacy GET returns a messages array`)
    assert(!!legacyData.threadId, `Legacy GET includes threadId for forward-compatibility`)

  } finally {
    // Cleanup
    await Chat.deleteMany({ sessionId: /^test-multi-/ })
    server.close()
    await mongoose.connection.close()

    console.log('\n────────────────────────────────────────────')
    console.log(`Results: ${pass} passed, ${fail} failed`)
    if (fail === 0) {
      console.log('🎉 ALL TESTS PASSED — Multi-chat system is secure and correct!')
    } else {
      console.error(`❌ ${fail} TEST(S) FAILED`)
      process.exit(1)
    }
  }
}

runTests().catch(err => {
  console.error('Test runner crashed:', err.message)
  process.exit(1)
})
