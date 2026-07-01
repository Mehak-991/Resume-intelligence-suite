import re
from typing import List, Dict, Any
import fitz  # PyMuPDF
import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv
from langchain_groq import ChatGroq

# -------------------------------
# Load environment and initialize Groq LLM
# -------------------------------
load_dotenv()

qlm = ChatGroq(
    model_name="openai/gpt-oss-20b",
    api_key=os.getenv("GROQ_API_KEY")
)

# -------------------------------
# PDF Text Extraction
# -------------------------------
def extract_text_from_pdf(file_path, max_chars=None):
    text = ""
    pdf_document = fitz.open(file_path)
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        page_text = page.get_text()
        if page_text:
            text += page_text + "\n"
    pdf_document.close()
    if max_chars:
        return text[:max_chars]
    return text

# -------------------------------
# Call Groq LLM
# -------------------------------
def call_groq(prompt):
    try:
        ai_message = qlm.invoke(prompt)
        response_text = ai_message.content if hasattr(ai_message, "content") else str(ai_message)
        return response_text
    except Exception as e:
        print("GROQ ERROR:", e)
        return f"Error: {e}"

# -------------------------------
# Save optimized resume as text
# -------------------------------
def save_resume_as_text(content, output_path="optimized_resume.txt"):
    if not isinstance(content, str):
        content = str(content)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return output_path

# ---------------------------------------------------------
# Build Prompt and Call LLM
# ---------------------------------------------------------
def build_and_call_llm(resume_pdf_path, jd_text):
    """Build structured prompt and call LLM."""
    resume_text = extract_text_from_pdf(resume_pdf_path)
    jd_text_truncated = jd_text[:1000]

    prompt = f"""You are a professional resume analyzer, career coach, and ATS optimization expert.

Analyze the candidate's resume against the job description below. You MUST follow this EXACT format with these EXACT section headers:

**OVERALL_ATS_SCORE**
[Provide a single number between 0-10, e.g., 7.5]

**STRENGTHS**
- [Strength 1]
- [Strength 2]
- [Strength 3]
[Continue with bullet points]

**IMPROVEMENTS**
- [Improvement 1]
- [Improvement 2]
- [Improvement 3]
[Continue with bullet points]

**KEYWORDS**
[Provide comma-separated keywords relevant to the job description]

**SUMMARY**
[Write a single paragraph optimized summary for the resume - no special formatting, just plain text]

**PERFORMANCE_METRICS**
Formatting: [score]/10
Content Quality: [score]/10
Keyword Usage: [score]/10
ATS Compatibility: [score]/10
Quantifiable Achievements: [score]/10

**ACTION_ITEMS**
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]
[Continue with numbered list]

**PRO_TIPS**
- [Tip 1]
- [Tip 2]
- [Tip 3]
[Continue with bullet points]

**ATS_CHECKLIST**
- [Checklist item 1]
- [Checklist item 2]
- [Checklist item 3]
[Continue with bullet points]

**OPTIMIZED_RESUME**
[Provide the complete optimized resume text here - plain text format, no markdown, no code blocks]

---

Resume Text:
{resume_text}

Job Description:
{jd_text_truncated}

IMPORTANT: Follow the exact format above. Use the exact section headers shown. Do not add extra formatting, markdown, or code blocks except where specified."""

    llm_response_text = call_groq(prompt)
    return llm_response_text


# ---------------------------------------------------------
# PARSER: Convert LLM Output → Structured JSON
# ---------------------------------------------------------
def parse_llm_resume(llm_text: str) -> Dict[str, Any]:
    """
    Parse LLM response with fixed format.
    Expects exact section headers as specified in the prompt.
    """
    result: Dict[str, Any] = {
        "overallATSScore": None,
        "strengths": [],
        "improvements": [],
        "keywords": [],
        "summary": None,
        "performanceMetrics": [],
        "actionItems": [],
        "proTips": [],
        "atsChecklist": [],
        "optimizedResume": None
    }

    text = llm_text.strip()

    # 1) Overall ATS Score
    score_match = re.search(
        r"\*\*OVERALL_ATS_SCORE\*\*\s*\n\s*([0-9]+(?:\.[0-9]+)?)",
        text, re.I
    )
    if score_match:
        result["overallATSScore"] = float(score_match.group(1))

    # 2) Strengths - bullets between STRENGTHS and next section
    strengths_match = re.search(
        r"\*\*STRENGTHS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if strengths_match:
        bullets = re.findall(r"^-\s+(.+)$", strengths_match.group(1), re.M)
        result["strengths"] = [b.strip() for b in bullets]

    # 3) Improvements - bullets
    improvements_match = re.search(
        r"\*\*IMPROVEMENTS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if improvements_match:
        bullets = re.findall(r"^-\s+(.+)$", improvements_match.group(1), re.M)
        result["improvements"] = [b.strip() for b in bullets]

    # 4) Keywords - comma-separated
    keywords_match = re.search(
        r"\*\*KEYWORDS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if keywords_match:
        keywords_text = keywords_match.group(1).strip()
        # Remove "Example:" line if present
        keywords_text = re.sub(r'Example:.*', '', keywords_text, flags=re.I | re.S)
        # Split by comma and clean
        keywords = [k.strip() for k in keywords_text.split(',') if k.strip()]
        result["keywords"] = keywords

    # 5) Summary - paragraph
    summary_match = re.search(
        r"\*\*SUMMARY\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if summary_match:
        result["summary"] = summary_match.group(1).strip()

    # 6) Performance Metrics - line format "Metric: score/10"
    metrics_match = re.search(
        r"\*\*PERFORMANCE_METRICS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if metrics_match:
        metrics_text = metrics_match.group(1)
        # Match lines like "Formatting: 7/10" or "Formatting: 7"
        metric_lines = re.findall(
            r"^([^:]+):\s*([0-9]+(?:\.[0-9]+)?)\s*(?:/10)?",
            metrics_text, re.M
        )
        for name, score in metric_lines:
            result["performanceMetrics"].append({
                "parameter": name.strip(),
                "score": float(score)
            })

    # 7) Action Items - numbered list
    action_match = re.search(
        r"\*\*ACTION_ITEMS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if action_match:
        items = re.findall(r"^\d+\.\s+(.+)$", action_match.group(1), re.M)
        result["actionItems"] = [item.strip() for item in items]

    # 8) Pro Tips - bullets
    tips_match = re.search(
        r"\*\*PRO_TIPS\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if tips_match:
        bullets = re.findall(r"^-\s+(.+)$", tips_match.group(1), re.M)
        result["proTips"] = [b.strip() for b in bullets]

    # 9) ATS Checklist - bullets
    checklist_match = re.search(
        r"\*\*ATS_CHECKLIST\*\*\s*\n(.*?)(?=\n\*\*[A-Z_]+\*\*|\Z)",
        text, re.S | re.I
    )
    if checklist_match:
        bullets = re.findall(r"^-\s+(.+)$", checklist_match.group(1), re.M)
        result["atsChecklist"] = [b.strip() for b in bullets]

    # 10) Optimized Resume - everything after header
    resume_match = re.search(
        r"\*\*OPTIMIZED_RESUME\*\*\s*\n(.*)",
        text, re.S | re.I
    )
    if resume_match:
        result["optimizedResume"] = resume_match.group(1).strip()

    return result

# -------------------------------
# FastAPI App
# -------------------------------
app = FastAPI(title="Resume Analyzer & Optimizer")
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.post("/analyze_resume/")
def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    resume_path = os.path.join(UPLOAD_FOLDER, resume.filename)
    with open(resume_path, "wb") as f:
        shutil.copyfileobj(resume.file, f)

    try:
        # Fixed: Removed the third parameter
        llm_output_text = build_and_call_llm(resume_path, job_description)

        # Parse LLM Output → JSON
        parsed_json = parse_llm_resume(llm_output_text)

        # Save optimized resume
        save_path = save_resume_as_text(
            parsed_json.get("optimizedResume", ""), 
            output_path="optimized_resume.txt"
        )

        return JSONResponse(content={
            "parsed_json": parsed_json,
            "raw_llm_output": llm_output_text,
            "optimized_resume_file": save_path
        })
    finally:
        if os.path.exists(resume_path):
            os.remove(resume_path)

# -------------------------------
# Run server
# -------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)