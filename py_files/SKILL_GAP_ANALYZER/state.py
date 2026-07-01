"""
Skill Gap Analyzer - Agent State Definitions
Shared state between all agents in the LangGraph workflow
"""

from typing import TypedDict, List, Dict, Optional


class SkillItem(TypedDict):
    """Individual skill with proficiency"""
    name: str
    proficiency: float  # 0-10 scale
    category: str  # e.g., "programming", "cloud", "database"


class SkillGap(TypedDict):
    """Identified skill gap"""
    skill: str
    importance: float  # 0-10 based on job requirements
    current_proficiency: float
    required_proficiency: float
    gap_severity: str  # "critical", "high", "medium", "low"


class CourseRecommendation(TypedDict):
    """Course recommendation for a skill"""
    skill: str
    course_title: str
    platform: str
    url: str
    duration_hours: float
    level: str  # "beginner", "intermediate", "advanced"
    is_free: bool


class AgentState(TypedDict):
    """
    Shared state across all agents in the workflow
    """
    # Input data
    resume_text: str
    job_description: str
    
    # Agent 1: Skill Extractor outputs
    candidate_skills: List[SkillItem]
    required_skills: List[SkillItem]
    extraction_status: str
    
    # Agent 2: Gap Calculator outputs
    skill_gaps: List[SkillGap]
    strong_skills: List[str]
    weak_skills: List[str]
    missing_skills: List[str]
    gap_analysis_status: str
    
    # Agent 3: Course Recommender outputs
    course_recommendations: List[CourseRecommendation]
    learning_roadmap: Dict[str, List[CourseRecommendation]]  # skill -> courses
    total_learning_time: float  # in hours
    recommendation_status: str
    
    # Visualization outputs
    visualization_paths: List[str]
    
    # Error handling
    errors: List[str]
    
    # Final status
    workflow_status: str  # "in_progress", "completed", "failed"