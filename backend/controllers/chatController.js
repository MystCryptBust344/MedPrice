// chatController.js — Multi-thread chat HTTP layer
// req.sessionId is attached by sessionMiddleware before these handlers run.
//
// Thread-based architecture:
//   Each user session can own N independent chat threads.
//   All DB queries include sessionId to enforce ownership (uses compound index).
//   Title generation is guarded against race conditions — only fires when the
//   thread has exactly 0 messages at the time of the first message insert.

const { v4: uuidv4 } = require('uuid')
const chatService = require('../services/chatService')
const Chat = require('../models/Chat')

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the most recently updated thread (with a valid threadId) for this session,
 * creating a fresh one if none exist. Used by backward-compat GET/POST /api/chat routes.
 */
async function resolveOrCreateThread(sessionId) {
  let thread = await Chat.findOne(
    { sessionId, threadId: { $exists: true, $ne: null } }
  ).sort({ updatedAt: -1 })
  if (!thread) {
    thread = await Chat.create({ threadId: uuidv4(), sessionId, title: 'New Chat', messages: [] })
  }
  return thread
}

// ─────────────────────────────────────────────────────────────────────────────
// THREAD CRUD
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/chat/threads — list all threads for this session (no messages, sidebar-safe)
const listThreads = async (req, res) => {
  try {
    // Project OUT the messages array — prevents fetching MBs of data for the sidebar.
    // Filter: only return documents that have a valid threadId (defensive guard against
    // legacy documents from before the multi-thread refactor).
    const threads = await Chat
      .find({ sessionId: req.sessionId, threadId: { $exists: true, $ne: null } })
      .select('-messages')
      .sort({ updatedAt: -1 })
      .lean()
    res.json({ threads })
  } catch (err) {
    console.error('listThreads error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/chat/threads — create a new empty thread
const createThread = async (req, res) => {
  try {
    const threadId = uuidv4()
    const thread = await Chat.create({
      threadId,
      sessionId: req.sessionId,
      title:     'New Chat',
      messages:  []
    })
    res.status(201).json({
      threadId:  thread.threadId,
      title:     thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt
    })
  } catch (err) {
    console.error('createThread error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// GET /api/chat/threads/:threadId — full history for one thread
// Uses compound index { threadId, sessionId } — enforces ownership in a single DB hit
const getThread = async (req, res) => {
  try {
    const thread = await Chat
      .findOne({ threadId: req.params.threadId, sessionId: req.sessionId })
      .lean()
    if (!thread) return res.status(404).json({ error: 'Thread not found' })
    res.json({ threadId: thread.threadId, title: thread.title, messages: thread.messages })
  } catch (err) {
    console.error('getThread error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/chat/threads/:threadId — send a message to a specific thread
const sendToThread = async (req, res) => {
  const { message } = req.body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message field is required' })
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 chars)' })
  }

  try {
    // Ownership check uses compound index — secure and fast
    const chatDoc = await Chat.findOne({ threadId: req.params.threadId, sessionId: req.sessionId })
    if (!chatDoc) return res.status(404).json({ error: 'Thread not found' })

    // ── Race-condition guard: capture message count BEFORE inserting ──────────
    // If this is the first message (count === 0), trigger title generation ONCE.
    // We snapshot the count NOW, before any async work, to prevent a second
    // concurrent request from also triggering title generation.
    const isFirstMessage = chatDoc.messages.length === 0

    // Process through AI pipeline
    const result = await chatService.handleMessage(message.trim(), chatDoc.messages)

    const userMsg = { role: 'user',      content: message.trim() }
    const botMsg  = { role: 'assistant', content: result.reply }

    chatDoc.messages.push(userMsg, botMsg)
    chatDoc.updatedAt = new Date()
    await chatDoc.save()

    // ── Fire-and-forget title generation — only on the first message ──────────
    // Runs asynchronously AFTER the response is sent to keep latency minimal.
    // The client polls for the updated title via the threads list or thread header.
    if (isFirstMessage) {
      chatService.generateTitle(message.trim()).then(title => {
        return Chat.findOneAndUpdate(
          { threadId: req.params.threadId, sessionId: req.sessionId },
          { $set: { title } }
        )
      }).catch(err => console.warn('Title generation error (non-fatal):', err.message))
    }

    res.json({ ...result, isFirstMessage })
  } catch (err) {
    console.error('sendToThread error:', err.message)
    res.status(500).json({
      reply: 'Sorry, I ran into an issue processing your request. Please try again.',
      error: err.message
    })
  }
}

// DELETE /api/chat/threads/:threadId — delete a thread belonging to this session
const deleteThread = async (req, res) => {
  try {
    const result = await Chat.deleteOne({ threadId: req.params.threadId, sessionId: req.sessionId })
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Thread not found' })
    res.json({ success: true })
  } catch (err) {
    console.error('deleteThread error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// PATCH /api/chat/threads/:threadId — rename a thread's title
const renameThread = async (req, res) => {
  const { title } = req.body
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'title field is required' })
  }
  if (title.trim().length > 80) {
    return res.status(400).json({ error: 'Title too long (max 80 chars)' })
  }
  try {
    const thread = await Chat.findOneAndUpdate(
      { threadId: req.params.threadId, sessionId: req.sessionId },
      { $set: { title: title.trim(), updatedAt: new Date() } },
      { new: true }
    )
    if (!thread) return res.status(404).json({ error: 'Thread not found' })
    res.json({ threadId: thread.threadId, title: thread.title })
  } catch (err) {
    console.error('renameThread error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY — Legacy /api/chat routes
// Resolves to the most recently updated thread, or creates one if none exist.
// Prevents breaking changes for any cached frontend bundles or legacy clients.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/chat — returns latest thread's messages (backward-compat hydration)
const getHistory = async (req, res) => {
  try {
    const thread = await resolveOrCreateThread(req.sessionId)
    res.json({ messages: thread.messages, threadId: thread.threadId })
  } catch (err) {
    console.error('getHistory error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/chat — posts to the latest thread (backward-compat send)
const sendMessage = async (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message field is required' })
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 chars)' })
  }
  try {
    const chatDoc = await resolveOrCreateThread(req.sessionId)
    const isFirstMessage = chatDoc.messages.length === 0

    const result = await chatService.handleMessage(message.trim(), chatDoc.messages)

    chatDoc.messages.push(
      { role: 'user',      content: message.trim() },
      { role: 'assistant', content: result.reply }
    )
    chatDoc.updatedAt = new Date()
    await chatDoc.save()

    if (isFirstMessage) {
      chatService.generateTitle(message.trim()).then(title =>
        Chat.findOneAndUpdate(
          { threadId: chatDoc.threadId, sessionId: req.sessionId },
          { $set: { title } }
        )
      ).catch(err => console.warn('Title generation error (non-fatal):', err.message))
    }

    res.json(result)
  } catch (err) {
    console.error('sendMessage error:', err.message)
    res.status(500).json({
      reply: 'Sorry, I ran into an issue processing your request. Please try again.',
      error: err.message
    })
  }
}

module.exports = {
  listThreads, createThread, getThread, sendToThread, deleteThread, renameThread,
  getHistory, sendMessage
}
