const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false })

const chatSchema = new mongoose.Schema({
  // threadId is NOT unique:true at field-level — enforced by compound index below
  // This is required for MongoDB sharding compatibility (shard key must be part of unique index)
  threadId:  { type: String, required: true, default: uuidv4 },
  sessionId: { type: String, required: true },
  title:     { type: String, default: 'New Chat' },
  messages:  [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// ── Compound unique index: enforces threadId uniqueness AND enables secure
//    ownership lookups (GET /threads/:id always filters by both threadId + sessionId).
//    Sharding-compatible: include sessionId (the future shard key) in the index.
chatSchema.index({ threadId: 1, sessionId: 1 }, { unique: true })

// ── Sidebar list index: fast sorted fetch of all threads for a session
chatSchema.index({ sessionId: 1, updatedAt: -1 })

// ── TTL: auto-expire inactive chats after 30 days of inactivity
chatSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

module.exports = mongoose.model('Chat', chatSchema)
