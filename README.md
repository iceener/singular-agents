# Singular-Agents

Singular Agent: A single-file agentic logic responsible for a specific process, such as managing tasks.

This repository demonstrates how to build simple yet powerful AI agents using minimal dependencies, such as [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction), [Zod](https://zod.dev/), and [Hono.dev](https://hono.dev/).

## Installation

1. Clone this repository.  
2. Install dependencies using `bun install`.  
3. Add API keys to the .env file.  
4. Run the project with `bun dev`.

## Linear

Linear integration enables you to interact with Issues (Create / Read / Update / Delete) using natural language. To activate it, first add your `LINEAR_API_KEY` to the `.env` file, and set `LINEAR_PROJECTS`, `LINEAR_WORKFLOW_STATUSES`, and `DEFAULT_PROJECT` in the `todo-manager.ts` file. 

Then you can chat with your Linear projects using OpenAI Chat Completion API format like this:

```bash
curl -X POST http://localhost:3000/api/linear \
-H "Content-Type: application/json" \
-d '{
  "messages": [
    { "role": "user", "content": "List my tasks I have unfinished yet" }
  ]
}'
```

## Author

Created by [overment's lab](https://brain.overment.com).