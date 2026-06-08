const express = require('express')
const router  = express.Router()

const {
  listThreads, createThread, getThread, sendToThread, deleteThread, renameThread,
  getHistory,  sendMessage
} = require('../controllers/chatController')

// ── Thread-based routes ───────────────────────────────────────────────────────
router.get   ('/threads',           listThreads)   // List all threads (no messages)
router.post  ('/threads',           createThread)  // Create new empty thread
router.get   ('/threads/:threadId', getThread)     // Fetch full history of one thread
router.post  ('/threads/:threadId', sendToThread)  // Send message to a thread
router.delete('/threads/:threadId', deleteThread)  // Delete a thread
router.patch ('/threads/:threadId', renameThread)  // Rename a thread

// ── Backward-compat legacy routes ────────────────────────────────────────────
// Resolve to the most recently updated thread so cached frontend bundles still work
router.get ('/', getHistory)    // GET  /api/chat
router.post('/', sendMessage)   // POST /api/chat

module.exports = router
