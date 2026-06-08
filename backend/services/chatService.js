// Chat pipeline
// 1. Search MongoDB for relevant procedures
// 2. Build system prompt with data context
// 3. Apply sliding-window history (last 8 turns)
// 4. Call Groq LLM

const Groq = require('groq-sdk')
const repo = require('../repositories/procedureRepository')

const NO_KEY_MSG = 'AI assistant is not configured. Please set GROQ_API_KEY in your .env file.'

// Sliding window cap — keeps the last N messages from history
const HISTORY_WINDOW = 8

/**
 * Handle an incoming chat message.
 * @param {string} userMessage   — The user's current message
 * @param {Array}  history       — Full session history (role/content pairs from DB)
 * @returns {object}             — { reply, procedures? }
 */
async function handleMessage(userMessage, history = []) {
  if (!process.env.GROQ_API_KEY) {
    return { reply: NO_KEY_MSG, source: 'fallback' }
  }

  // Step 1: Search DB for relevant procedures
  let relevantProcedures = []
  try {
    const textResults = await repo.textSearch(userMessage, 0, 3)
    if (textResults.length > 0) relevantProcedures = textResults
  } catch (_) { /* ignore */ }

  // Step 2: Build data context for system prompt
  let dataContext = ''
  if (relevantProcedures.length > 0) {
    dataContext = relevantProcedures.map(p => {
      const sorted   = [...p.hospitals].sort((a, b) => a.price - b.price)
      const cheapest = sorted[0]
      const priciest = sorted[sorted.length - 1]
      return (
        `• ${p.commonName} (${p.category})\n` +
        `  Government CGHS rate: ₹${p.cghsRate}\n` +
        `  Cheapest hospital: ${cheapest.name} at ₹${cheapest.price}\n` +
        `  Most expensive: ${priciest.name} at ₹${priciest.price}`
      )
    }).join('\n\n')
  }

  const systemPrompt =
    `You are MedPrice AI, an expert Indian healthcare cost assistant. ` +
    `Help users understand medical procedure costs and find affordable hospitals in India.\n\n` +
    `Rules:\n` +
    `- Always ground your answer in the data provided below — never invent prices or hospital names\n` +
    `- Express prices in Indian Rupees (₹) with Indian number formatting\n` +
    `- Mention the government CGHS rate as the benchmark when available\n` +
    `- Keep answers concise: 2–4 sentences maximum\n` +
    `- If no matching data is found, suggest the user try a different search term\n` +
    `- If asked something unrelated to healthcare costs, politely redirect\n\n` +
    (dataContext
      ? `Relevant MedPrice database records:\n\n${dataContext}`
      : `No matching procedure found in the database for this query.`)

  // Step 3: Sliding window — take only the last HISTORY_WINDOW messages
  // This prevents context explosion and keeps token usage bounded
  const windowedHistory = history.slice(-HISTORY_WINDOW).map(m => ({
    role:    m.role,
    content: m.content
  }))

  // Step 4: Call Groq LLM
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  let completion
  try {
    completion = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...windowedHistory,
        { role: 'user',   content: userMessage }
      ],
      max_tokens:  280,
      temperature: 0.3
    })
  } catch (err) {
    if (err.status === 401) return { reply: '⚠️ Invalid Groq API key.', source: 'error' }
    if (err.status === 429) return { reply: 'Rate limit reached. Please wait a moment and try again.', source: 'error' }
    if (err.status === 400) return { reply: 'Model error. Please check server logs.', source: 'error' }
    throw err
  }

  const reply = completion.choices[0].message.content.trim()

  return {
    reply,
    procedures: relevantProcedures.map(p => ({
      id:         p._id,
      commonName: p.commonName,
      cghsRate:   p.cghsRate,
      category:   p.category
    }))
  }
}

/**
 * Generate a short, friendly thread title from the user's first message.
 * Intentionally tiny: 32 tokens max, temperature 0 for determinism.
 * Called only when messages.length === 0 (race-condition guarded in controller).
 * @param {string} firstMessage — the user's first chat message in this thread
 * @returns {string}           — a 4-6 word title, e.g. "Knee replacement cost India"
 */
async function generateTitle(firstMessage) {
  if (!process.env.GROQ_API_KEY) return 'New Chat'
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You create ultra-short chat thread titles for a medical cost assistant app. ' +
            'Reply with ONLY a 4-6 word title — no quotes, no punctuation, no explanation. ' +
            'Focus on the medical topic. Example: "Knee replacement cost India"'
        },
        { role: 'user', content: firstMessage }
      ],
      max_tokens:  32,
      temperature: 0
    })
    const raw = completion.choices[0].message.content.trim()
    // Guard: if model returns something weird (blank, too long), fall back gracefully
    return raw.length > 0 && raw.length < 80 ? raw : 'New Chat'
  } catch (_) {
    return 'New Chat'
  }
}

module.exports = { handleMessage, generateTitle }

