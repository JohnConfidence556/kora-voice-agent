import asyncio
import json

import config  # must come first: it loads your .env keys
import tools
from livekit.agents import (
    Agent, AgentSession, JobContext, JobProcess, RunContext,
    WorkerOptions, cli, function_tool,
)
from livekit.plugins import groq, silero

from rag import Retriever

MAX_CALL_SECONDS = 300  # hard server-side limit; keep it equal to the number in VoiceCall.tsx

INSTRUCTIONS = """You are an unofficial voice assistant for a demo telecom app that uses MTN Nigeria plan information.
You are an independent demo project, not MTN. Accounts and money here are simulated.

Rules:
- For ANY question about MTN plans, prices, rates, codes or services, call search_knowledge_base first and answer ONLY from its result.
- If it finds nothing reliable, say you are not sure and suggest dialing 180 or visiting an MTN service centre. Do not guess.
- For the caller's own balance, plan, SIM status or history, ALWAYS call the account tools. Never invent numbers.
- To buy data or airtime, call the prepare tools. They only PREPARE an order. Tell the caller to tap Confirm on the
  yellow card on their dashboard. NEVER say a purchase is done until the caller says they confirmed it.
- For data plans use the exact plan id from list_available_plans. If the request is unclear, ask one short question.
- You are speaking out loud. Keep answers to one to three short sentences. No lists, no markdown.
- Say prices in words: "800 naira", not "N800".
- Say codes the way people dial them: "*406*1#" becomes "star 406 star 1 hash".
- If information has a last-updated date older than a few weeks, mention that plans may have changed.
"""


class Assistant(Agent):
    def __init__(self, retriever, user_id):
        super().__init__(instructions=INSTRUCTIONS)
        self.retriever = retriever
        self.user_id = user_id  # who is calling (None if we could not tell)

    @function_tool
    async def search_knowledge_base(self, context: RunContext, question: str) -> str:
        """Look up MTN Nigeria plan, price, rate, code and service information.

        Args:
            question: The caller's question, rewritten as a clear standalone search query.
        """
        return tools.search_knowledge(self.retriever, question)

    @function_tool
    async def get_my_account(self, context: RunContext) -> str:
        """Get the caller's SIM status, airtime balance, data balance and active plan."""
        return tools.account_summary(self.user_id)

    @function_tool
    async def get_my_recent_transactions(self, context: RunContext) -> str:
        """Get the caller's most recent transactions."""
        return tools.recent_transactions(self.user_id)

    @function_tool
    async def list_available_plans(self, context: RunContext) -> str:
        """List the data plans that can be bought in this app, with their ids and prices."""
        return tools.plans_text()

    @function_tool
    async def prepare_data_purchase(self, context: RunContext, plan_id: str) -> str:
        """Prepare (not complete) a data plan purchase. The caller must confirm it on their dashboard.

        Args:
            plan_id: The plan id exactly as shown by list_available_plans.
        """
        return tools.prepare_data_purchase(self.user_id, plan_id)

    @function_tool
    async def prepare_airtime_topup(self, context: RunContext, amount: int) -> str:
        """Prepare (not complete) an airtime top-up. The caller must confirm it on their dashboard.

        Args:
            amount: Amount in naira, between 50 and 5000.
        """
        return tools.prepare_airtime_topup(self.user_id, amount)


def prewarm(proc: JobProcess):
    # Load heavy things once per worker process, before any caller connects
    proc.userdata["vad"] = silero.VAD.load()
    proc.userdata["retriever"] = Retriever()


async def find_user_id(ctx: JobContext):
    """The website puts the logged-in user's id inside the signed call token. Read it here."""
    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=10)
        return json.loads(participant.metadata or "{}").get("user_id")
    except (asyncio.TimeoutError, ValueError):
        return None


async def enforce_time_limit(ctx: JobContext, session: AgentSession):
    await asyncio.sleep(MAX_CALL_SECONDS - 10)   # wait until 10 seconds before the limit
    try:
        await session.say("We've reached the time limit for this demo call. Goodbye!")
    except Exception:
        pass                                      # if speaking fails, still hang up
    await asyncio.sleep(10)                       # give the goodbye time to play
    ctx.shutdown(reason="demo call time limit")   # the agent leaves, which ends the call

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    user_id = await find_user_id(ctx)
    print(f"call started, user_id={user_id}")

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=groq.STT(model=config.STT_MODEL, language="en"),
        llm=groq.LLM(model=config.LLM_MODEL),
        tts=groq.TTS(model=config.TTS_MODEL, voice=config.TTS_VOICE),
    )
    await session.start(room=ctx.room, agent=Assistant(ctx.proc.userdata["retriever"], user_id))
    limit_task = asyncio.create_task(enforce_time_limit(ctx, session))
    ctx.add_shutdown_callback(lambda: limit_task.cancel())
    await session.generate_reply(
        instructions="Greet the caller briefly, say you are an unofficial demo assistant, and ask how you can help."
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            initialize_process_timeout=60,  # give the knowledge base time to load
            num_idle_processes=1,
        )
    )