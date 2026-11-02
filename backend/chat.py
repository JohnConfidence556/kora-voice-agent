"""The text chat assistant: Groq LLM + the same tools as the voice agent."""
import json

from groq import Groq

import config
import tools

MAX_HISTORY = 12     # only the last 12 messages are sent to the model
MAX_CHARS = 1000     # longest single message we accept
MAX_STEPS = 4        # most tool-call rounds per reply

SYSTEM_PROMPT = """You are an unofficial chat assistant for a demo telecom app that uses MTN Nigeria plan information.
You are an independent demo project, not MTN. Accounts and money here are simulated.

Rules:
- For ANY question about MTN plans, prices, rates, codes or services, call search_knowledge_base first and answer ONLY from its result.
- If it finds nothing reliable, say you are not sure and suggest dialing 180 or visiting an MTN service centre. Never guess prices or codes.
- For the user's own balance, plan, SIM status or history, ALWAYS call the account tools. Never invent numbers.
- To buy data or airtime, call the prepare tools. They only PREPARE an order. Tell the user to press Confirm on the
  yellow 'Waiting for your confirmation' card on their dashboard. NEVER say a purchase is done or paid until the user
  tells you they confirmed it.
- For data plans use the exact plan id from list_available_plans. If the user's wish is unclear, ask one short question.
- Keep replies short and plain: one to four sentences. Prices in naira (for example 800 naira).
"""

TOOL_SPECS = [
    {"type": "function", "function": {
        "name": "search_knowledge_base",
        "description": "Look up MTN Nigeria plan, price, rate, code and service information.",
        "parameters": {"type": "object", "properties": {
            "question": {"type": "string", "description": "The question as a clear standalone search query"}},
            "required": ["question"]}}},
    {"type": "function", "function": {
        "name": "get_my_account",
        "description": "Get the logged-in user's SIM status, airtime balance, data balance and active plan.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_my_recent_transactions",
        "description": "Get the logged-in user's most recent transactions.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "list_available_plans",
        "description": "List the data plans that can be bought in this app, with their ids and prices.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "prepare_data_purchase",
        "description": "Prepare (NOT complete) a data plan purchase. The user must confirm it on their dashboard.",
        "parameters": {"type": "object", "properties": {
            "plan_id": {"type": "string", "description": "Plan id from list_available_plans"}},
            "required": ["plan_id"]}}},
    {"type": "function", "function": {
        "name": "prepare_airtime_topup",
        "description": "Prepare (NOT complete) an airtime top-up. The user must confirm it on their dashboard.",
        "parameters": {"type": "object", "properties": {
            "amount": {"type": "integer", "description": "Amount in naira, 50 to 5000"}},
            "required": ["amount"]}}},
]


def _run_tool(name: str, args: dict, user_id: int, retriever) -> str:
    try:
        if name == "search_knowledge_base":
            return tools.search_knowledge(retriever, str(args.get("question", "")))
        if name == "get_my_account":
            return tools.account_summary(user_id)
        if name == "get_my_recent_transactions":
            return tools.recent_transactions(user_id)
        if name == "list_available_plans":
            return tools.plans_text()
        if name == "prepare_data_purchase":
            return tools.prepare_data_purchase(user_id, str(args.get("plan_id", "")))
        if name == "prepare_airtime_topup":
            return tools.prepare_airtime_topup(user_id, int(args.get("amount")))
    except (TypeError, ValueError):
        return "Invalid arguments for this tool."
    return f"Unknown tool: {name}"


def clean_history(history: list[dict]) -> list[dict]:
    """Keep only user/assistant text, trimmed in length and count. Never trust the browser's roles."""
    cleaned = [
        {"role": m["role"], "content": str(m["content"])[:MAX_CHARS]}
        for m in history
        if m.get("role") in ("user", "assistant") and str(m.get("content", "")).strip()
    ]
    return cleaned[-MAX_HISTORY:]


def run_chat(user_id: int, history: list[dict], retriever, client=None) -> str:
    client = client or Groq(api_key=config.GROQ_API_KEY)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + clean_history(history)

    for _ in range(MAX_STEPS):
        response = client.chat.completions.create(
            model=config.LLM_MODEL, messages=messages, tools=TOOL_SPECS, tool_choice="auto", temperature=0.2,
        )
        msg = response.choices[0].message
        if not msg.tool_calls:
            return (msg.content or "").strip() or "Sorry, I couldn't come up with an answer."

        # The model asked to use tools: run them and feed the results back
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": _run_tool(tc.function.name, args, user_id, retriever)})

    return "Sorry, that took too many steps. Please try asking in a simpler way."