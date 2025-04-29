import { Hono } from 'hono'
import { serve } from 'bun'
import { runTasks } from './linear/todo-manager'
import type { OpenAIRequestBody, OpenAIResponseBody } from './types/app';

const app = new Hono()

app.post('/api/linear', async (c): Promise<Response> => {
    try {
        const body = await c.req.json<OpenAIRequestBody>()
        const userContent = body.messages?.findLast(m => m.role === 'user')?.content;

        if (!userContent) {
             console.error("No user message content found in request body:", body);
             return c.json({ error: "Bad Request: No user message content found." }, 400);
        }

        const answer: OpenAIResponseBody = await runTasks(userContent);
        return c.json(answer);

    } catch (error: any) {
        console.error("Error processing /api/linear request:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return c.json({ choices: [ { index: 0, message: { role: "assistant", content: `Server error: ${errorMessage}`, refusal: null, annotations: [] } } ] }, 500);
    }
});

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
});


