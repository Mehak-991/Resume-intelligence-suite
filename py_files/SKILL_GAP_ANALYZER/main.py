"""
FastAPI application for Skill Gap Analyzer
Provides REST API endpoints for the agentic workflow
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import uvicorn
import os
from datetime import datetime
import uuid
import json
import fitz  # PyMuPDF for PDF extraction

# Import from existing files
from workflow import create_skill_gap_workflow, print_summary
from state import AgentState
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Skill Gap Analyzer API",
    description="LangGraph-based agentic system for skill gap analysis and course recommendations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for analysis results (use Redis/DB in production)
analysis_results = {}


# Helper function to extract text from PDF
def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF"""
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        
        # Extract text from each page
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text += page.get_text()
        
        pdf_document.close()
        
        if not text.strip():
            raise ValueError("PDF appears to be empty or contains only images")
        
        return text
    
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )


# Pydantic models for request/response
class SkillItemResponse(BaseModel):
    name: str
    proficiency: float
    category: str


class SkillGapResponse(BaseModel):
    skill: str
    importance: float
    current_proficiency: float
    required_proficiency: float
    gap_severity: str


class CourseResponse(BaseModel):
    skill: str
    course_title: str
    platform: str
    url: str
    duration_hours: float
    level: str
    is_free: bool


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    candidate_skills: List[SkillItemResponse]
    required_skills: List[SkillItemResponse]
    skill_gaps: List[SkillGapResponse]
    strong_skills: List[str]
    weak_skills: List[str]
    missing_skills: List[str]
    course_recommendations: List[CourseResponse]
    total_learning_time: float
    learning_roadmap: Dict[str, List[CourseResponse]]
    visualization_paths: List[str]
    errors: List[str]
    created_at: str


class AnalysisStatusResponse(BaseModel):
    analysis_id: str
    status: str
    message: str
    progress: str


# Helper functions
def run_analysis(analysis_id: str, resume_text: str, job_description: str):
    """
    Background task to run the skill gap analysis
    """
    try:
        # Update status
        analysis_results[analysis_id]["status"] = "processing"
        analysis_results[analysis_id]["progress"] = "Initializing agents..."
        
        # Initialize state
        initial_state = {
            "resume_text": resume_text,
            "job_description": job_description,
            "candidate_skills": [],
            "required_skills": [],
            "extraction_status": "pending",
            "skill_gaps": [],
            "strong_skills": [],
            "weak_skills": [],
            "missing_skills": [],
            "gap_analysis_status": "pending",
            "course_recommendations": [],
            "learning_roadmap": {},
            "total_learning_time": 0.0,
            "recommendation_status": "pending",
            "visualization_paths": [],
            "errors": [],
            "workflow_status": "in_progress"
        }
        
        # Create workflow
        analysis_results[analysis_id]["progress"] = "Extracting skills..."
        app_workflow = create_skill_gap_workflow()
        
        # Execute workflow
        analysis_results[analysis_id]["progress"] = "Calculating gaps..."
        final_state = app_workflow.invoke(initial_state)
        
        # Store results
        analysis_results[analysis_id]["progress"] = "Generating recommendations..."
        analysis_results[analysis_id]["status"] = "completed"
        analysis_results[analysis_id]["result"] = final_state
        analysis_results[analysis_id]["progress"] = "Complete"
        
    except Exception as e:
        analysis_results[analysis_id]["status"] = "failed"
        analysis_results[analysis_id]["error"] = str(e)
        analysis_results[analysis_id]["progress"] = f"Failed: {str(e)}"


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Skill Gap Analyzer API",
        "version": "1.0.0",
        "endpoints": {
            "POST /analyze": "Start a new skill gap analysis (with PDF resume)",
            "GET /analysis/{analysis_id}": "Get analysis results",
            "GET /analysis/{analysis_id}/status": "Check analysis status",
            "GET /visualization/{analysis_id}/{file_name}": "Download visualization file",
            "GET /health": "Health check"
        },
        "note": "Resume must be uploaded as PDF file. Job description as text."
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    groq_configured = bool(os.getenv("GROQ_API_KEY"))
    
    return {
        "status": "healthy" if groq_configured else "warning",
        "timestamp": datetime.utcnow().isoformat(),
        "groq_api_configured": groq_configured,
        "message": "GROQ_API_KEY is required for skill extraction" if not groq_configured else "All systems operational"
    }


@app.post("/analyze", response_model=AnalysisStatusResponse)
async def create_analysis(
    background_tasks: BackgroundTasks,
    resume_pdf: UploadFile = File(..., description="Resume in PDF format"),
    job_description: str = Form(..., description="Job description as text")
):
    """
    Start a new skill gap analysis
    
    - **resume_pdf**: Upload resume as PDF file
    - **job_description**: Paste job description as text
    
    Returns analysis_id to track progress
    """
    
    # Validate PDF file
    if not resume_pdf.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Resume must be a PDF file"
        )
    
    # Validate GROQ API Key
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured. Please add it to .env file"
        )
    
    # Generate unique analysis ID
    analysis_id = str(uuid.uuid4())
    
    try:
        # Read PDF file
        pdf_bytes = await resume_pdf.read()
        
        # Extract text from PDF
        print(f"📄 Extracting text from PDF: {resume_pdf.filename}")
        resume_text = extract_text_from_pdf(pdf_bytes)
        print(f"✓ Extracted {len(resume_text)} characters from PDF")
        
        # Initialize analysis record
        analysis_results[analysis_id] = {
            "status": "queued",
            "progress": "Queued",
            "created_at": datetime.utcnow().isoformat(),
            "resume_filename": resume_pdf.filename,
            "resume_text": resume_text[:500] + "...",  # Store preview only
            "job_description": job_description[:500] + "..."  # Store preview only
        }
        
        # Add background task
        background_tasks.add_task(
            run_analysis,
            analysis_id,
            resume_text,
            job_description
        )
        
        return AnalysisStatusResponse(
            analysis_id=analysis_id,
            status="queued",
            message="Analysis started successfully. PDF processed.",
            progress="Queued for processing"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )


@app.get("/analysis/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(analysis_id: str):
    """
    Check the status of an analysis
    """
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = analysis_results[analysis_id]
    
    return AnalysisStatusResponse(
        analysis_id=analysis_id,
        status=analysis["status"],
        message=f"Analysis is {analysis['status']}",
        progress=analysis.get("progress", "Unknown")
    )


@app.get("/analysis/{analysis_id}")
async def get_analysis_results(analysis_id: str):
    """
    Get complete analysis results
    """
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = analysis_results[analysis_id]
    
    if analysis["status"] == "processing" or analysis["status"] == "queued":
        return JSONResponse(
            status_code=202,
            content={
                "analysis_id": analysis_id,
                "status": analysis["status"],
                "message": "Analysis still in progress",
                "progress": analysis.get("progress", "Processing...")
            }
        )
    
    if analysis["status"] == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {analysis.get('error', 'Unknown error')}"
        )
    
    # Return complete results
    result = analysis.get("result", {})
    
    return AnalysisResponse(
        analysis_id=analysis_id,
        status=analysis["status"],
        candidate_skills=[SkillItemResponse(**s) for s in result.get("candidate_skills", [])],
        required_skills=[SkillItemResponse(**s) for s in result.get("required_skills", [])],
        skill_gaps=[SkillGapResponse(**g) for g in result.get("skill_gaps", [])],
        strong_skills=result.get("strong_skills", []),
        weak_skills=result.get("weak_skills", []),
        missing_skills=result.get("missing_skills", []),
        course_recommendations=[CourseResponse(**c) for c in result.get("course_recommendations", [])],
        total_learning_time=result.get("total_learning_time", 0.0),
        learning_roadmap=result.get("learning_roadmap", {}),
        visualization_paths=result.get("visualization_paths", []),
        errors=result.get("errors", []),
        created_at=analysis["created_at"]
    )


@app.get("/analysis/{analysis_id}/summary")
async def get_analysis_summary(analysis_id: str):
    """
    Get a concise summary of the analysis
    """
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = analysis_results[analysis_id]
    
    if analysis["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed yet")
    
    result = analysis.get("result", {})
    
    return {
        "analysis_id": analysis_id,
        "summary": {
            "total_skills_analyzed": len(result.get("required_skills", [])),
            "strong_skills_count": len(result.get("strong_skills", [])),
            "weak_skills_count": len(result.get("weak_skills", [])),
            "missing_skills_count": len(result.get("missing_skills", [])),
            "total_gaps": len(result.get("skill_gaps", [])),
            "critical_gaps": len([g for g in result.get("skill_gaps", []) if g.get("gap_severity") == "critical"]),
            "high_priority_gaps": len([g for g in result.get("skill_gaps", []) if g.get("gap_severity") == "high"]),
            "courses_recommended": len(result.get("course_recommendations", [])),
            "total_learning_hours": result.get("total_learning_time", 0.0),
            "estimated_weeks": round(result.get("total_learning_time", 0.0) / 40, 1)
        },
        "top_missing_skills": result.get("missing_skills", [])[:5],
        "top_weak_skills": result.get("weak_skills", [])[:5],
        "top_strong_skills": result.get("strong_skills", [])[:5]
    }


@app.get("/visualization/{analysis_id}/{file_name}")
async def get_visualization(analysis_id: str, file_name: str):
    """
    Download a specific visualization file
    """
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = analysis_results[analysis_id]
    
    if analysis["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed yet")
    
    # Construct file path
    file_path = os.path.join("outputs", file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Visualization file not found")
    
    return FileResponse(
        file_path,
        media_type="text/html",
        filename=file_name
    )


@app.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str):
    """
    Delete an analysis and its results
    """
    if analysis_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Delete from memory
    del analysis_results[analysis_id]
    
    return {
        "message": "Analysis deleted successfully",
        "analysis_id": analysis_id
    }


@app.get("/analyses")
async def list_analyses():
    """
    List all analyses
    """
    analyses_list = []
    
    for analysis_id, data in analysis_results.items():
        analyses_list.append({
            "analysis_id": analysis_id,
            "status": data["status"],
            "created_at": data["created_at"],
            "progress": data.get("progress", "Unknown"),
            "resume_filename": data.get("resume_filename", "N/A")
        })
    
    return {
        "total": len(analyses_list),
        "analyses": analyses_list
    }


# Error handlers
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc)
        }
    )


if __name__ == "__main__":
    # Run the API server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )