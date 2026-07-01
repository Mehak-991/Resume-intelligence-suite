"""
FastAPI Application for AI Mock Interview System
Voice-based interview with audio answer evaluation
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import json
import uuid
import shutil
from datetime import datetime
from pathlib import Path
import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import interview system components
from parser import ResumeJDParser
from question_generator import QuestionGenerator
from interview_agent import InterviewAgent
from feedback_generator import FeedbackGenerator
from speech_to_text import SpeechToText

# Initialize FastAPI app
app = FastAPI(
    title="AI Mock Interview System API",
    description="Voice-based AI interview system with audio answer evaluation",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize directories
UPLOAD_DIR = Path("uploads")
REPORTS_DIR = Path("reports")
AUDIO_DIR = Path("audio_files")

for directory in [UPLOAD_DIR, REPORTS_DIR, AUDIO_DIR]:
    directory.mkdir(exist_ok=True)

# Initialize components
parser = ResumeJDParser()
question_gen = QuestionGenerator()
interview_agent = InterviewAgent()
feedback_gen = FeedbackGenerator()
stt = SpeechToText()

# Session storage
sessions: Dict[str, Dict[str, Any]] = {}

# ===========================
# Pydantic Models
# ===========================

class InterviewSetupResponse(BaseModel):
    session_id: str = Field(..., description="UUID session identifier")
    message: str
    questions_count: int
    questions_preview: List[Dict[str, str]]

class QuestionResponse(BaseModel):
    question_number: int
    total_questions: int
    question: str
    difficulty: str

class AnswerAnalysisResponse(BaseModel):
    question_number: int
    transcription: str
    word_count: int
    analysis: Dict[str, Any]
    speech_metrics: Dict[str, Any]
    feedback: str

class SessionStatus(BaseModel):
    session_id: str
    candidate_name: str
    position: str
    total_questions: int
    answered_questions: int
    status: str

class HealthCheck(BaseModel):
    status: str
    timestamp: str
    components: Dict[str, bool]

# ===========================
# Helper Functions
# ===========================

def create_session(candidate_name: str, position: str, resume_text: str, jd_text: str, questions: List[Dict]) -> str:
    """Create a new interview session"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'session_id': session_id,
        'candidate_name': candidate_name,
        'position': position,
        'resume_text': resume_text,
        'jd_text': jd_text,
        'questions': questions,
        'current_question': 0,
        'answers': [],
        'created_at': datetime.now().isoformat(),
        'status': 'active'
    }
    return session_id

def get_session(session_id: str) -> Dict[str, Any]:
    """Get session data"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return sessions[session_id]

def save_uploaded_file(upload_file: UploadFile, directory: Path) -> Path:
    """Save uploaded file"""
    file_path = directory / f"{uuid.uuid4()}_{upload_file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return file_path

def cleanup_file(file_path: Path):
    """Delete file if it exists"""
    try:
        if file_path.exists():
            os.remove(file_path)
    except Exception as e:
        print(f"Warning: Could not delete {file_path}: {e}")

# ===========================
# API Endpoints
# ===========================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint"""
    return {
        "message": "AI Mock Interview System API - Voice Based",
        "version": "2.0.0",
        "status": "active",
        "documentation": "/docs",
        "endpoints": {
            "setup": "POST /api/interview/setup",
            "get_question": "GET /api/interview/question/{session_id}",
            "submit_answer": "POST /api/interview/answer",
            "get_report": "GET /api/interview/report/{session_id}",
            "status": "GET /api/interview/status/{session_id}"
        }
    }

@app.get("/health", response_model=HealthCheck, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return HealthCheck(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        components={
            "parser": True,
            "question_generator": True,
            "interview_agent": True,
            "feedback_generator": True,
            "speech_to_text": True
        }
    )

@app.post("/api/interview/setup", response_model=InterviewSetupResponse, tags=["Interview"])
async def setup_interview(
    resume: UploadFile = File(..., description="Resume file (PDF, DOCX, or TXT)"),
    candidate_name: str = Form(..., description="Candidate's full name"),
    position: str = Form(..., description="Position applying for"),
    job_description: str = Form(..., description="Job description as text (string)")
):
    """
    Setup interview session
    - Upload resume file
    - Provide JD as text string (not file)
    - Generates exactly 10 questions (4 easy, 4 medium, 2 hard)
    """
    try:
        # Save and parse resume
        resume_path = save_uploaded_file(resume, UPLOAD_DIR)
        resume_text = parser.parse_file(str(resume_path))
        
        # Use JD text directly (no file needed)
        jd_text = job_description
        
        # Validate inputs
        if not resume_text or len(resume_text) < 50:
            cleanup_file(resume_path)
            raise HTTPException(status_code=400, detail="Resume text is too short or empty")
        
        if not jd_text or len(jd_text) < 50:
            cleanup_file(resume_path)
            raise HTTPException(status_code=400, detail="Job description text is too short or empty")
        
        # Generate 10 questions
        questions = question_gen.generate_questions(resume_text, jd_text)
        
        # Verify we have exactly 10 questions
        if len(questions) != 10:
            print(f"Warning: Expected 10 questions, got {len(questions)}")
        
        # Create session
        session_id = create_session(candidate_name, position, resume_text, jd_text, questions)
        
        # Cleanup resume file
        cleanup_file(resume_path)
        
        # Preview questions
        questions_preview = [
            {
                "difficulty": q["difficulty"],
                "question": q["question"][:100] + "..." if len(q["question"]) > 100 else q["question"]
            }
            for q in questions
        ]
        
        return InterviewSetupResponse(
            session_id=session_id,
            message="Interview setup successful. Ready to start.",
            questions_count=len(questions),
            questions_preview=questions_preview
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")

@app.get("/api/interview/question/{session_id}", response_model=QuestionResponse, tags=["Interview"])
async def get_current_question(session_id: str):
    """Get current question for the session"""
    try:
        session = get_session(session_id)
        
        current_idx = session['current_question']
        questions = session['questions']
        
        if current_idx >= len(questions):
            raise HTTPException(
                status_code=400, 
                detail=f"All questions completed. Total: {len(questions)}"
            )
        
        question = questions[current_idx]
        
        return QuestionResponse(
            question_number=current_idx + 1,
            total_questions=len(questions),
            question=question['question'],
            difficulty=question['difficulty']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/answer", response_model=AnswerAnalysisResponse, tags=["Interview"])
async def submit_voice_answer(
    session_id: str = Form(..., description="Session UUID"),
    question_number: int = Form(..., description="Question number being answered"),
    audio_answer: UploadFile = File(..., description="Audio file with spoken answer (WAV, MP3, M4A)")
):
    """
    Submit voice answer for a question
    - Accepts audio file instead of text
    - Transcribes audio to text using Groq Whisper
    - Analyzes the answer based on existing evaluation parameters
    - Provides comprehensive feedback
    - Moves to next question
    """
    try:
        session = get_session(session_id)
        
        # Validate question number
        question_idx = question_number - 1
        if question_idx >= len(session['questions']) or question_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid question number")
        
        # Verify this is the current question
        if question_idx != session['current_question']:
            raise HTTPException(
                status_code=400, 
                detail=f"Expected question {session['current_question'] + 1}, got {question_number}"
            )
        
        question_data = session['questions'][question_idx]
        
        # Save audio file temporarily
        audio_path = save_uploaded_file(audio_answer, AUDIO_DIR)
        
        # Transcribe audio to text
        print(f"Transcribing audio for question {question_number}...")
        transcription = stt.transcribe(str(audio_path))
        
        if not transcription:
            cleanup_file(audio_path)
            raise HTTPException(status_code=400, detail="Could not transcribe audio. Please try again.")
        
        # Get audio duration (approximate based on file size)
        audio_size_kb = audio_path.stat().st_size / 1024
        estimated_duration = audio_size_kb / 10  # Rough estimate: 10KB per second
        
        # Cleanup audio file
        cleanup_file(audio_path)
        
        print(f"Transcription: {transcription[:100]}...")
        print(f"Analyzing answer...")
        
        # Analyze the transcribed answer
        analysis = interview_agent.analyze_answer(
            question=question_data['question'],
            answer=transcription,
            difficulty=question_data['difficulty'],
            resume_context=session['resume_text'],
            jd_context=session['jd_text']
        )
        
        # Calculate speech metrics
        speech_metrics = interview_agent.calculate_speech_metrics(
            transcription,
            estimated_duration
        )
        
        # Store answer
        session['answers'].append({
            'question_number': question_number,
            'question': question_data['question'],
            'difficulty': question_data['difficulty'],
            'answer': transcription,
            'analysis': analysis,
            'speech_metrics': speech_metrics,
            'duration': estimated_duration
        })
        
        # Move to next question
        session['current_question'] = question_number
        
        print(f"Answer analyzed. Score: {analysis.get('overall_score', 0)}/100")
        
        return AnswerAnalysisResponse(
            question_number=question_number,
            transcription=transcription,
            word_count=len(transcription.split()),
            analysis=analysis,
            speech_metrics=speech_metrics,
            feedback=analysis.get('feedback', 'Answer received and analyzed.')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Answer submission failed: {str(e)}")

@app.get("/api/interview/status/{session_id}", response_model=SessionStatus, tags=["Interview"])
async def get_session_status(session_id: str):
    """Get current session status and progress"""
    try:
        session = get_session(session_id)
        
        return SessionStatus(
            session_id=session_id,
            candidate_name=session['candidate_name'],
            position=session['position'],
            total_questions=len(session['questions']),
            answered_questions=len(session['answers']),
            status=session['status']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/interview/report/{session_id}", tags=["Interview"])
async def get_interview_report(session_id: str):
    """
    Generate and retrieve final interview report
    Returns comprehensive analysis with scores and recommendations
    """
    try:
        session = get_session(session_id)
        
        if len(session['answers']) == 0:
            raise HTTPException(status_code=400, detail="No answers submitted yet. Complete the interview first.")
        
        # Mark session as completed
        session['status'] = 'completed'
        
        # Prepare data for report generation
        interview_data = {
            'candidate_name': session['candidate_name'],
            'position': session['position'],
            'date': session['created_at'],
            'questions_and_answers': session['answers']
        }
        
        # Generate comprehensive report
        report = feedback_gen.generate_final_report(interview_data)
        
        # Save report to file
        report_filename = f"interview_report_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = REPORTS_DIR / report_filename
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"Report generated and saved: {report_filename}")
        
        return JSONResponse(content=report)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@app.delete("/api/interview/session/{session_id}", tags=["Interview"])
async def end_session(session_id: str):
    """
    End and cleanup interview session
    """
    try:
        session = get_session(session_id)
        session['status'] = 'ended'
        
        return {
            "message": "Session ended successfully",
            "session_id": session_id,
            "total_questions": len(session['questions']),
            "answered_questions": len(session['answers']),
            "completion_rate": f"{(len(session['answers']) / len(session['questions']) * 100):.1f}%"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# Startup/Shutdown
# ===========================

@app.on_event("startup")
async def startup_event():
    print("\n" + "="*60)
    print("AI Mock Interview System API Started")
    print("="*60)
    print(f"Upload Directory: {UPLOAD_DIR}")
    print(f"Reports Directory: {REPORTS_DIR}")
    print(f"Audio Directory: {AUDIO_DIR}")
    print(f"API Documentation: http://localhost:8000/docs")
    print("="*60 + "\n")

@app.on_event("shutdown")
async def shutdown_event():
    print("\nShutting down API...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)