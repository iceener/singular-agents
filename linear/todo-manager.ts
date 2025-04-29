// @ts-nocheck
import { LinearClient } from "@linear/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, CoreMessage } from "ai";
import { z } from "zod";

// ---------------------------------------------------
// --- Constants & Config ---
// ---------------------------------------------------
const DEFAULT_PROJECT = "ad799a5f-259c-4ff1-9387-efb949a56508";
const USER_NAME = "Adam";
const AI_NAME = "Alice";

const now = new Date();
const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
const date = now.toISOString().slice(0, 10);
const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, });
const TODAY_DATE_FORMATTED = `${weekday}, ${date} ${time}`;

const context = `You are ${AI_NAME}, a helpful assistant.`;

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_DEFAULT_TEAM_ID = process.env.LINEAR_DEFAULT_TEAM_ID || "22919b24-e2be-4655-be8e-1e493561541f"; 
const LINEAR_DEFAULT_ASSIGNEE_ID = process.env.LINEAR_DEFAULT_ASSIGNEE_ID || "384901b5-dd22-402e-9114-c19970743b94";

if (!process.env.OPENAI_API_KEY) {
  throw new Error( "Missing OpenAI API key. Set OPENAI_API_KEY environment variable." );
}

if (!LINEAR_API_KEY) {
  throw new Error( "Missing Linear API key. Set LINEAR_API_KEY environment variable." );
}

const LINEAR_PROJECTS = [
  {
    id: "ad799a5f-259c-4ff1-9387-efb949a56508",
    name: "overment",
    description:
      "Personal tasks, YouTube channel development, social media engagement, and programming education. This is the default project for tasks that don't fit elsewhere.",
  },
  {
    id: "a1c39fbd-b462-44cb-a9e9-eefe9afd6471",
    name: "easy_",
    description:
      "Centers on digital marketing and sales, including blog post creation, marketing strategies, and product development.",
  },
  {
    id: "1b587de1-4734-4de4-b540-5dc360bd6c1a",
    name: "tech•sistence",
    description:
      "Dedicated to newsletters, product development, and AI research.",
  },
  {
    id: "4ce13c4d-cf86-4812-b1bc-f2374c71774d",
    name: "eduweb",
    description:
      "Focuses on educational content creation, including online courses and workshops, newsletter production, and managing the Ahoy! community. Also covers financial management and educational project oversight.",
  },
  {
    id: "873cbb34-5c12-48d4-ab6d-c8fc6b4f8379",
    name: "Alice",
    description:
      "Tasks and information related to the Alice / heyalice.app project. That's desktop app for macOS that allows interaction for macOS and the user is Creator and Developer of it.",
  },
];

// Linear workflow state UUIDs
const LINEAR_WORKFLOW_STATUSES = [
  { id: "fd9e4c84-ecc3-4c04-973f-26fac2d0b294", name: "New" },
  { id: "f96f2997-50b8-40c1-a1c8-90b8869a3d32", name: "Canceled" },
  { id: "d414e77c-0bb9-4554-88fb-1dba0fa3b434", name: "Backlog" },
  { id: "9e510759-093b-41df-9cb8-9ff8a0d4cb1c", name: "Current" },
  { id: "599ef3db-5579-48c9-8482-04508f75f868", name: "Done" },
];

// --------------------------------------------------------------------
// --- Linear API Client & Functions ---
// --------------------------------------------------------------------

const linearClient = new LinearClient({ apiKey: LINEAR_API_KEY });

async function createIssues(inputs) {
  const results = inputs.map(async (input) => {
    const payload = await linearClient.createIssue(input);
    const issue = payload.issue ? await payload.issue : null;
    if (!payload.success || !issue) {
      throw new Error(`Failed to create issue for: ${input.title}`);
    }
    return {
      success: true,
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
    };
  });
  return Promise.all(results);
}

async function updateIssues(inputs) {
  const results = inputs.map(async ({ id, ...data }) => {
    const payload = await linearClient.updateIssue(id, data);
    const issue = payload.issue ? await payload.issue : null;
    if (!payload.success || !issue) {
      throw new Error(`Failed to update issue with id ${id}`);
    }
    return {
      success: true,
      id: issue.id,
      title: issue.title,
      url: issue.url,
    };
  });
  return Promise.all(results);
}

async function removeIssues(ids) {
  const results = ids.map(async (id) => {
    const payload = await linearClient.archiveIssue(id);
    if (!payload.success) {
      throw new Error(`Failed to archive issue with id ${id}`);
    }
    return { id, success: true };
  });
  return Promise.all(results);
}

async function getIssuesInRange(input) {
  // Simplified date calculation for default range (-7/+7 days)
  const today = new Date();
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 7);
  const defaultEndDate = new Date(today);
  defaultEndDate.setDate(today.getDate() + 7);

  const startDate =
    input?.startDate || defaultStartDate.toISOString().slice(0, 10);
  const endDate = input?.endDate || defaultEndDate.toISOString().slice(0, 10);
  const first = input?.first;
  const after = input?.after;

  const query = `
        query getIssuesInRange($first: Int, $after: String, $gte: TimelessDateOrDuration!, $lte: TimelessDateOrDuration!) {
        issues(first: $first, after: $after, filter: { dueDate: { gte: $gte, lte: $lte } }) {
            nodes {
            id
            title
            description
            createdAt
            dueDate
            url
            state { name }
            project { id name }
            }
        }
        }
    `;

  try {
    const response = await linearClient.client.rawRequest(query, {
      first,
      after,
      gte: startDate,
      lte: endDate,
    });

    // Map the raw nodes to the concise format
    return response.data.issues.nodes.map((node) => ({
      id: node.id,
      project_id: node.project?.id ?? "N/A", // Handle potential null project
      title: node.title,
      description: node.description ?? null, // Ensure null if missing
      dueDate: node.dueDate ?? null, // Ensure null if missing
      createdAt: node.createdAt,
      url: node.url,
      stateName: node.state?.name ?? "N/A", // Handle potential null state
      projectName: node.project?.name ?? "N/A", // Handle potential null project
    }));
  } catch (error) {
    console.error("Error fetching issues in range:", error);
    throw error; // Re-throw the error after logging
  }
}

// ---------------------------------------------------
// --- Tool Definitions ---
// ---------------------------------------------------

const tools = [
  {
    name: "get_tasks",
    description: "Get issues in a date range (by default -7 / +7 days from current date)",
    schema: z.object({
      startDate: z.string().optional().describe("Start date of the range (YYYY-MM-DD) you want to get tasks for. Defaults to 7 days ago."),
      endDate: z.string().optional().describe("End date of the range (YYYY-MM-DD) you want to get tasks for. Defaults to 7 days from now."),
    }),
  },
  {
    name: "add_task",
    description: "List of tasks to add to the Linear",
    schema: z.object({
      inputs: z.array(
        z.object({
          teamId: z.string().default(LINEAR_DEFAULT_TEAM_ID),
          title: z.string(),
          description: z.string().optional(),
          priority: z.number().optional(),
          dueDate: z.string().optional(),
          projectId: z .string() .describe( `UUID of the project to assign the task to. Defaults to "${DEFAULT_PROJECT}" project if no other project matches the task description.` ),
          assigneeId: z.string().optional().default(LINEAR_DEFAULT_ASSIGNEE_ID),
        })
      ),
    }),
  },
  {
    name: "update_task",
    description: "List of tasks to update in Linear",
    schema: z.object({
      inputs: z.array(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          priority: z.number().optional(),
          dueDate: z.string().optional(),
          projectId: z .string() .describe( `UUID of the project to assign the task to. Defaults to "${DEFAULT_PROJECT}" project if no other project matches the task description.` ),
          assigneeId: z.string().optional().default(LINEAR_DEFAULT_ASSIGNEE_ID),
          stateId: z.string().optional(),
          parentId: z.string().optional(),
          estimate: z.number().optional(),
        })
      ),
    }),
  },
  {
    name: "delete_task",
    description: "List of tasks to delete (archive) from the Linear",
    schema: z.object({
      ids: z.array(z.string()),
    }),
  },
  {
    name: "contact_user",
    description: "Use this tool to contact the user for assistance, to report results, or to request information.",
    schema: z.object({}),
  },
];

const actions = new Map([
  ["add_task", (args) => createIssues(args.inputs)],
  ["update_task", (args) => updateIssues(args.inputs)],
  ["delete_task", (args) => removeIssues(args.ids)],
  ["get_tasks", getIssuesInRange],
]);

// ---------------------------------------------------------
// --- Prompts ---
// ---------------------------------------------------------

const decideSchema = z.object({
  _thinking: z.string(),
  action: z.enum(tools.map((t) => t.name)),
});

const decidePrompt = (
  state
) => `As an AI agent you have access to the Linear API, projects and tasks of the user named ${USER_NAME}.

You're now in the middle of a thinking loop in which you decide what to do next based on the ongoing conversation and the available context and the actions you have already taken. Your task is to identify the name of a tool you need to use next without repeating the same action without any reason.

<context>
Today is ${TODAY_DATE_FORMATTED}.
Your general knowledge about the user:
${context}
</context>

<available_tools>
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}
</available_tools>

<response_format>
Your very next response must be a JSON object with the following structure:
{
    _thinking: "Your internal thoughts in the form of a comma-separated-list of ideas and observations, such as 'add task request, next step should be: add_task'. Keep it ultra-concise.",
    action: "Name of the tool you need to use, for example: add_task"
}
</response_format>

<rules>
- To update/delete a task(s), first use "get_tasks" to retrieve the tasks that are already on the list.
- When getting a task(s), specify the range of due dates as -7 to +7 days from today (unless the user mentions older or newer tasks, in which case, adjust the range accordingly)
- When you don't have enough information to make a decision or you're unable to perform the action, contact the user.
- When you're done, contact the user.
</rules>
`;

const describeRules = `
1. Tasks should be named using 1-5 words in the first person present tense, such as "Meet with John" or "Do the training."
2. The task name should capture the essence of the task and include keywords such as names, places, actions, etc.
3. The project must be assigned with high certainty or default to "${DEFAULT_PROJECT}." Available projects: ${LINEAR_PROJECTS.map(
  (p) => p.name
).join(", ")}. Use the corresponding project ID.
4. The due date must be determined based on the context (today is ${TODAY_DATE_FORMATTED}) and be in YYYY-MM-DD format; if that's not possible, leave it blank.
5. Anything that does not fit into the task name should be included in the description.
6. Since our task system does not support time in the due date, when time is mentioned, it should be added at the end of the description.
`;

const describePrompt = (state) => {
  return `You're an AI agent named ${AI_NAME}, chatting with a user named ${USER_NAME}.

<rules>
- Your purpose is to describe the arguments for the tool ${ state.action } in a structure described by its corresponding schema.
- ${ state.action === "add_task" ? `<naming_and_description_rules>${describeRules}</naming_rules>` : "" }
- ${ state.action === "update_task" ? `<update_rules>Only include fields that need changing. Provide the task ID.</update_rules>` : "" }
- ${ state.action === "delete_task" ? `<delete_rules>Provide the list of task IDs to delete.</delete_rules>` : "" }
- ${ state.action === "get_tasks" ? `<get_rules>Provide the start and end dates in YYYY-MM-DD format. Default is -7/+7 days from today (${TODAY_DATE_FORMATTED}).</get_rules>` : "" }
</rules>

<context>
Today is ${TODAY_DATE_FORMATTED}. Use this information to determine the date range and due date for the tasks.

Your general knowledge about the user:
${context}
</context>

<available_projects> 
${LINEAR_PROJECTS.map(
  (p) => `${p.name} (UUID: ${p.id}): ${p.description}`
).join("\n")}
</available_projects>

<available_statuses>
${LINEAR_WORKFLOW_STATUSES.map((s) => `${s.name} (UUID: ${s.id})`).join("\n")}
</available_statuses>

Please provide the arguments for the '${state.action}' tool as a JSON object.`;
};

// ---------------------------------------------
// --- Core Logic ---
// ---------------------------------------------

export async function runTasks(initialUserMessage: string) {
  if (!initialUserMessage) {
    return createAssistantResponse("Error: initialUserMessage is required.");
  }

  const state = { limit: 15, action: null as string | null, messages: [] as CoreMessage[],
  };

  function assistantMessage(content: string) {
    console.log( `[ASSISTANT]: ${content.slice(0, 200)}${ content.length > 200 ? "..." : "" }` );
    state.messages.push({ role: "assistant", content });
  }

  function createAssistantResponse(content: string) {
    return {
      choices: [ { index: 0, message: { role: "assistant" as const, content: content, refusal: null, annotations: [] }, }, ],
    };
  }

  function userMessage(content: string) {
    console.log(`[USER]: ${content}`);
    state.messages.push({ role: "user", content });
  }

  userMessage(initialUserMessage);

  async function decide() {
    console.log("--- Deciding ---");
    const result = await generateObject({
      model: openai("gpt-4.1-mini"),
      schema: decideSchema,
      messages: state.messages,
      system: decidePrompt(state),
    });
    console.log("Decision:", result.object);
    return result;
  }

  async function describe() {
    console.log(`--- Describing args for: ${state.action} ---`);
    const tool = tools.find((t) => t.name === state.action);
    if (!tool) throw new Error(`Schema for tool ${state.action} not found`);

    const result = await generateObject({
      model: openai("gpt-4.1-mini"),
      system: describePrompt(state),
      messages: state.messages,
      schema: tool.schema,
    });
    console.log("Arguments:", result.object);
    return result;
  }

  let finalContent = ""; // Variable to store the final message content


  // ------------------------------------------------------------
  // --- Main reasoning-execution loop ---
  // ------------------------------------------------------------
  while (state.limit > 0 && state.action !== "contact_user") {
    console.log( `=== Iteration ${16 - state.limit} (Limit: ${state.limit}) ===` );
    state.limit--;

    try {
      // 1. Decide
      const decision = await decide();
      state.action = decision.object.action;
      assistantMessage(`Okay, I will use the '${state.action}' tool.`);

      if (state.action === "contact_user") {
        console.log("Action is 'contact_user', exiting loop.");
        break;
      }

      // 2. Describe
      const args = await describe();

      // 3. Execute
      const action = actions.get(state.action);
      if (!action) {
        throw new Error(`Tool function for ${state.action} not found.`);
      }
      console.log(`--- Executing: ${state.action} ---`);
      const result = await action(args.object);
      console.log("Action Result:", result);
      
      const resultSummary = typeof result === "object" && result !== null ? JSON.stringify(result) : String(result);
      assistantMessage( `I have executed the '${state.action}' action. Result: ${resultSummary}` );

    } catch (error: unknown) {
      console.error(`Error in iteration ${16 - state.limit}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      finalContent = `I encountered an error: ${errorMessage}. I had to stop processing your request.`;
      state.action = "contact_user";
      break;
    }
  }

  console.log("--- Loop Finished ---");

  // Generate Final Response only if no error occurred during the loop that set finalContent
  if (!finalContent) {
    console.log("--- Generating Final Response ---");

    const finalPrompt = `You're an AI agent named ${AI_NAME}, chatting with a user named ${USER_NAME}.

<rules>
- You speak concisely, using conversational, well formatted format (preferably markdown prose, without extensive formatting unless necessary)
- You use available information to provide factual answers, while keeping in mind that the user does not see your internal state
- You can manage user's tasks in Linear. Actions you performed are available within the conversation context
</rules>

<context>
Today is ${TODAY_DATE_FORMATTED}. Use this information to determine the date range and due date for the tasks.
</context>`;

    const answer = await generateText({
      model: openai("gpt-4.1-mini"), // Using o4-mini
      messages: state.messages, // Use the accumulated messages
      system: finalPrompt,
    });

    finalContent = answer.text; // Store the generated text
  } else {
    console.log("--- Using Pre-determined Error Response ---");
    console.log(finalContent);
  }

  console.log("--- Final Answer ---");
  console.log(finalContent);

  return createAssistantResponse(finalContent);
}
