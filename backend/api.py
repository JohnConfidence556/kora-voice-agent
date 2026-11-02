import os
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import accounts
import chat
import config
import purchases
from catalog import DATA_PLANS
from db import init_db


def seed_demo_account():
    """Make sure a ready-to-use demo login exists, even after the database is wiped."""
    email = os.getenv("DEMO_EMAIL", "demo@kora.app")
    password = os.getenv("DEMO_PASSWORD", "demo1234")
    try:
        accounts.sign_up(email, password)
    except accounts.AccountError:
        pass  # it already exists, nothing to do


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # create the tables on startup if they are missing
    seed_demo_account()
    yield


app = FastAPI(title="MTN demo backend", lifespan=lifespan)

# Allow the Next.js frontend (a different address) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Credentials(BaseModel):
    email: str
    password: str


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """Reads 'Authorization: Bearer <token>' and returns that user's profile, or 401."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = accounts.get_user_by_token(token) if token else None
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return user


@app.post("/auth/signup")
def signup(body: Credentials):
    try:
        token, user = accounts.sign_up(body.email, body.password)
    except accounts.AccountError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": token, "user": user}


@app.post("/auth/login")
def login(body: Credentials):
    try:
        token, user = accounts.log_in(body.email, body.password)
    except accounts.AccountError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": token, "user": user}


@app.post("/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    accounts.log_out((authorization or "").removeprefix("Bearer ").strip())
    return {"ok": True}


@app.get("/me")
def me(user: dict = Depends(current_user)):
    return user


@app.get("/transactions")
def transactions(user: dict = Depends(current_user)):
    return accounts.list_transactions(user["id"])


# ---------- Shopping: the AI can PREPARE orders, only the logged-in user CONFIRMS them ----------

class OrderRequest(BaseModel):
    kind: str                    # "data" or "airtime"
    item_id: str | None = None   # for data plans
    amount: int | None = None    # for airtime


@app.get("/catalog")
def catalog():
    return DATA_PLANS


@app.post("/orders")
def create_order(body: OrderRequest, user: dict = Depends(current_user)):
    try:
        return purchases.prepare_order(user["id"], body.kind, body.item_id, body.amount)
    except purchases.PurchaseError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/orders/pending")
def pending_orders(user: dict = Depends(current_user)):
    return purchases.list_pending(user["id"])


@app.post("/orders/{order_id}/confirm")
def confirm_order(order_id: str, user: dict = Depends(current_user)):
    try:
        return purchases.confirm_order(user["id"], order_id)
    except purchases.PurchaseError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str, user: dict = Depends(current_user)):
    try:
        return purchases.cancel_order(user["id"], order_id)
    except purchases.PurchaseError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Chat assistant ----------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


_retriever = None
_retriever_lock = threading.Lock()


def get_retriever():
    """Load the knowledge base the first time it is needed (it takes a few seconds)."""
    global _retriever
    with _retriever_lock:
        if _retriever is None:
            from rag import Retriever
            _retriever = Retriever()
    return _retriever


# Simple per-user limit so a demo link can't burn all your Groq credits
CHAT_LIMIT = 20            # messages ...
CHAT_WINDOW_SECONDS = 300  # ... per 5 minutes
_chat_times: dict[int, deque] = defaultdict(deque)


def _check_chat_rate(user_id: int) -> None:
    now = time.time()
    times = _chat_times[user_id]
    while times and now - times[0] > CHAT_WINDOW_SECONDS:
        times.popleft()
    if len(times) >= CHAT_LIMIT:
        raise HTTPException(status_code=429, detail="You're sending messages too fast. Please wait a few minutes.")
    times.append(now)


@app.post("/chat")
def chat_endpoint(body: ChatRequest, user: dict = Depends(current_user)):
    _check_chat_rate(user["id"])
    try:
        reply = chat.run_chat(user["id"], [m.model_dump() for m in body.messages], get_retriever())
    except Exception as e:  # model or network problem: don't crash, tell the user
        print("chat error:", repr(e))
        raise HTTPException(status_code=502, detail="The assistant is having trouble right now. Please try again.")
    return {"reply": reply}