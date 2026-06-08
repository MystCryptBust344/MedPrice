/**
 * migrate-threadids.js
 * One-time migration: backfill threadId and title on all legacy chat documents
 * that were created before the multi-thread refactor.
 */
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '.env') })

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const col = mongoose.connection.db.collection('chats')

  // Find all documents missing threadId field entirely
  const legacyDocs = await col.find({ threadId: { $exists: false } }).toArray()
  console.log('Docs missing threadId:', legacyDocs.length)

  for (const doc of legacyDocs) {
    const newThreadId = uuidv4()
    await col.updateOne(
      { _id: doc._id },
      { $set: { threadId: newThreadId, title: 'Chat History', updatedAt: doc.createdAt || new Date() } }
    )
    console.log('  Migrated (no threadId):', doc.sessionId?.slice(0, 8), '->', newThreadId.slice(0, 8))
  }

  // Also fix any documents where threadId is explicitly null
  const nullDocs = await col.find({ threadId: null }).toArray()
  console.log('Docs with null threadId:', nullDocs.length)

  for (const doc of nullDocs) {
    const newThreadId = uuidv4()
    await col.updateOne(
      { _id: doc._id },
      { $set: { threadId: newThreadId, title: 'Chat History', updatedAt: doc.createdAt || new Date() } }
    )
    console.log('  Fixed (null threadId):', doc.sessionId?.slice(0, 8), '->', newThreadId.slice(0, 8))
  }

  console.log('\nVerifying final state:')
  const all = await col.find({}).toArray()
  let ok = 0, bad = 0
  all.forEach(d => {
    if (!d.threadId) {
      console.error('  STILL MISSING threadId:', d.sessionId?.slice(0, 8))
      bad++
    } else {
      console.log('  OK | session:', d.sessionId?.slice(0, 8), '| thread:', d.threadId.slice(0, 8), '| title:', d.title)
      ok++
    }
  })

  console.log(`\nMigration done: ${ok} OK, ${bad} still broken`)
  await mongoose.connection.close()
  process.exit(bad > 0 ? 1 : 0)
}

migrate().catch(err => { console.error(err.message); process.exit(1) })
