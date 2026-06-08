require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

async function test() {
  try {
    const res = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [{role: 'user', content: 'test'}],
      max_tokens: 10
    });
    console.log(res);
  } catch (err) {
    console.log("ERROR IS:");
    console.log(err);
  }
}
test();
