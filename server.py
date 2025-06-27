from fastapi import FastAPI, Request
from pydantic import BaseModel
import os
import json

from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Optional: use supabase-py client
# pip install supabase
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class Command(BaseModel):
    action: str
    payload: dict = {}

@app.post("/webhook")
async def run_action(command: Command):
    action = command.action
    payload = command.payload

    if action == "echo":
        return {"message": payload}

    elif action == "list_files":
        return {"files": os.listdir(".")}

    elif action == "read_file":
        filepath = payload.get("path")
        if not filepath or not os.path.exists(filepath):
            return {"error": "Invalid file path"}
        with open(filepath, "r") as f:
            content = f.read()
        return {"content": content}

    elif action == "write_file":
        filepath = payload.get("path")
        content = payload.get("content", "")
        if not filepath:
            return {"error": "Missing file path"}
        with open(filepath, "w") as f:
            f.write(content)
        return {"message": f"Wrote to {filepath}"}

    elif action == "query_supabase":
        table = payload.get("table")
        filters = payload.get("filters", {})
        if not table:
            return {"error": "Missing table name"}
        query = supabase.table(table)
        for col, val in filters.items():
            query = query.eq(col, val)
        response = query.select("*").execute()
        return {"data": response.data}

    else:
        return {"error": f"Unknown action: {action}"}



