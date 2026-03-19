import express from 'express';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are a helpful assistant for Community Guardian, a community safety and alert platform. 
Your role is to:
- Help users understand how to use the app (feed, circles, alerts)
- Answer questions about community safety features
- Guide users on reporting incidents and joining circles
- Provide general safety tips and information
- Be friendly, concise, and helpful

Key features you can explain:
- Feed: View and interact with community alerts and incidents
- Circles: Join or create neighborhood groups for localized alerts
- Profile: Manage account settings and notification preferences
- Alerts: Real-time notifications about safety incidents in your area

Keep responses brief and actionable.`;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    res.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
