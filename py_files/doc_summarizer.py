import os
import json
import time
import requests
import fitz  # PyMuPDF
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_groq import ChatGroq

# ---------------------------------------------------------
# 1. Load environment + initialize Groq LLM
# ---------------------------------------------------------

load_dotenv()

qlm = ChatGroq(
    model_name="openai/gpt-oss-20b"
)

# ---------------------------------------------------------
# 2. Extract text from URL or PDF
# ---------------------------------------------------------
def extract_text_from_url(url: str) -> str:
    """Extract raw text from a webpage."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text(separator="\n")
    return text



def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from a PDF using PyMuPDF."""
    text = ""
    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text()
    return text


# ---------------------------------------------------------
# 3. Summarization Prompt Templates
# ---------------------------------------------------------

SYSTEM_PROMPT = """
You are an expert document summarizer. Produce clear, accurate, and neutral summaries.
Always output clean JSON and nothing else.
Avoid hallucinations. Preserve factual accuracy from the document.
"""

USER_PROMPT_TEMPLATE = """
DOCUMENT_CHUNK:
\"\"\"{chunk_text}\"\"\"


INSTRUCTIONS:
Return a well-structured JSON with the following top-level fields:

- title: short title for the chunk
- tldr: one-sentence TL;DR (<= 30 words)
- short_summary: 2-4 sentence summary
- long_summary: deeper 6-8 sentence summary
- bullets: list of 6 key bullet points
- key_facts: list of objects {{ "fact": "...", "source_snippet": "..." }}
- important_quotes: up to 3 short direct quotes
- entities: list of named entities found
- unanswered_questions: list of open questions
- action_items: list of follow-up actions
- reading_time_minutes: integer
- confidence: "low" | "medium" | "high"

RULES:
- Must be valid JSON.
- Do NOT add text outside JSON.
- If a field has no value, return an empty string/list.
- Use only information found in the chunk.

Respond ONLY with JSON.
"""

# ---------------------------------------------------------
# 4. Chunking text
# ---------------------------------------------------------

def chunk_text(text: str, max_chars=3500, overlap_chars=250):
    """Split long text into overlapping chunks for LLM."""
    if not text:
        return []

    chunks = []
    start = 0
    n = len(text)

    while start < n:
        end = start + max_chars
        if end >= n:
            chunks.append(text[start:])
            break

        cut = text.rfind("\n", start, end)
        if cut == -1:
            cut = text.rfind(" ", start, end)
        if cut == -1:
            cut = end

        chunks.append(text[start:cut])
        start = cut - overlap_chars
        if start < 0:
            start = 0

    return chunks


# ---------------------------------------------------------
# 5. Summarize a single chunk
# ---------------------------------------------------------

def summarize_chunk_with_prompt(chunk_text, max_retries=2, retry_delay=1.0):
    """Summarize one text chunk using the custom JSON prompt."""
    user_prompt = USER_PROMPT_TEMPLATE.format(chunk_text=chunk_text)
    full_prompt = SYSTEM_PROMPT + "\n\n" + user_prompt

    for attempt in range(max_retries + 1):
        try:
            resp = qlm.invoke(full_prompt)
            raw = resp.content.strip()

            # Attempt direct JSON parse
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                # Extract JSON substring if extra text exists
                s = raw.find("{")
                e = raw.rfind("}")
                if s != -1 and e != -1:
                    try:
                        return json.loads(raw[s:e+1])
                    except:
                        return {"error_raw": raw}

        except Exception as e:
            if attempt < max_retries:
                time.sleep(retry_delay)
            else:
                return {"error": str(e)}

    return {"error": "unknown"}


# ---------------------------------------------------------
# 6. Merge chunk summaries into final summary
# ---------------------------------------------------------

def aggregate_chunk_summaries(chunk_summaries):
    tldrs = [c.get("tldr", "") for c in chunk_summaries if c.get("tldr")]

    bullets = []
    for c in chunk_summaries:
        bullets.extend(c.get("bullets", []))

    key_facts = []
    for c in chunk_summaries:
        key_facts.extend(c.get("key_facts", []))

    merge_input = {
        "tldrs": tldrs,
        "bullets": bullets[:50],
        "key_facts": key_facts[:200]
    }

    FINAL_PROMPT = f"""
You are an expert summarizer. Combine the following chunk summaries:

INPUT:
{json.dumps(merge_input, ensure_ascii=False, indent=2)}

Return JSON with:
- final_tldr: 1-sentence summary
- executive_summary: 5-8 sentence summary
- top_bullets: top 10 bullet points
- combined_key_facts: merged factual objects
- overall_confidence: low/medium/high

Only return JSON.
"""

    resp = qlm.invoke(SYSTEM_PROMPT + FINAL_PROMPT)
    raw = resp.content.strip()

    try:
        return json.loads(raw)
    except:
        s = raw.find("{")
        e = raw.rfind("}")
        if s != -1 and e != -1:
            try:
                return json.loads(raw[s:e+1])
            except:
                pass

    return {"error_raw": raw}


# ---------------------------------------------------------
# 7. Top-level function to summarize any text document
# ---------------------------------------------------------

def summarize_text_document(full_text: str):
    chunks = chunk_text(full_text)
    chunk_results = []

    for i, ch in enumerate(chunks):
        print(f"Summarizing chunk {i+1}/{len(chunks)} (len={len(ch)})...")
        chunk_summary = summarize_chunk_with_prompt(ch)
        chunk_results.append(chunk_summary)

    final_summary = aggregate_chunk_summaries(chunk_results)

    return {
        "chunk_summaries": chunk_results,
        "final_summary": final_summary
    }


# ---------------------------------------------------------
# 8. FastAPI Backend Added Below
# ---------------------------------------------------------

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Document Summarizer API",
    description="Summarize PDFs or URLs using Llama-3-120B (Groq)",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Document Summarizer API is running 🚀"}

@app.post("/summarize/url")
async def summarize_url(url: str = Form(...)):
    """Summarize a webpage from URL."""
    text = extract_text_from_url(url)
    result = summarize_text_document(text)
    return result

@app.post("/summarize/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    """Summarize an uploaded PDF file."""
    file_path = "uploaded.pdf"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    text = extract_text_from_pdf(file_path)
    result = summarize_text_document(text)
    return result

# ---------------------------------------------------------
# Run command:
# uvicorn app:app --reload
# ---------------------------------------------------------

