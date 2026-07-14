"""
Agent 1: Skill Extractor
Uses Groq LLM to extract skills from resume and job description
"""

import os
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from state import AgentState, SkillItem
import json
import time


class SkillExtractorAgent:
    """
    Extracts technical skills from resume and job description
    Uses Groq for enhanced extraction
    """
    
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        
        if not self.groq_api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables. Please add it to .env file")
        
        self.llm = ChatGroq(
            api_key=self.groq_api_key,
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_retries=3
        )
    
    def extract_skills_with_llm(self, text: str, context: str, max_retries: int = 3) -> List[SkillItem]:
        """Use Groq LLM for comprehensive skill extraction with retry logic"""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert technical recruiter and skill analyzer.
Extract ALL technical skills from the provided text and rate them on a 0-10 proficiency scale.

For each skill, provide:
1. Skill name (standardized, e.g., "Python" not "python programming")
2. Proficiency score (0-10, based on context clues like years of experience, project complexity)
3. Category (programming, cloud, database, devops, frontend, backend, ml, etc.)

Return ONLY valid JSON array format:
[
  {"name": "Python", "proficiency": 8.5, "category": "programming"},
  {"name": "Kubernetes", "proficiency": 6.0, "category": "devops"}
]

Be comprehensive but accurate. Include:
- Programming languages
- Frameworks and libraries
- Cloud platforms
- Databases
- DevOps tools
- Soft skills (leadership, communication, etc.)
- Domain knowledge
"""),
            ("user", f"Context: {context}\n\nText to analyze:\n{text}")
        ])
        
        for attempt in range(max_retries):
            try:
                response = self.llm.invoke(prompt.format_messages())
                
                # Parse JSON response
                try:
                    skills_data = json.loads(response.content)
                    # Validate skill objects have required fields
                    validated_skills = []
                    for skill in skills_data:
                        if isinstance(skill, dict):
                            # Normalize skill name - try multiple possible keys
                            skill_name = skill.get('name') or skill.get('skill') or skill.get('title')
                            if skill_name:
                                skill['name'] = skill_name  # Ensure 'name' key exists
                                validated_skills.append(skill)
                    return validated_skills
                except json.JSONDecodeError:
                    # Fallback: try to extract JSON from response
                    import re
                    json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
                    if json_match:
                        skills_data = json.loads(json_match.group())
                        # Validate skill objects have required fields
                        validated_skills = []
                        for skill in skills_data:
                            if isinstance(skill, dict):
                                skill_name = skill.get('name') or skill.get('skill') or skill.get('title')
                                if skill_name:
                                    skill['name'] = skill_name
                                    validated_skills.append(skill)
                        return validated_skills
                    else:
                        raise ValueError("Could not parse JSON from LLM response")
                        
            except Exception as e:
                print(f"  [WARNING] Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise Exception(f"Failed after {max_retries} attempts. Error: {str(e)}")
        
        return []
    
    def __call__(self, state: AgentState) -> AgentState:
        """
        Main agent execution
        Extracts skills from both resume and job description
        """
        print("\n[SEARCH] AGENT 1: Skill Extractor - Starting...")
        
        try:
            # Validate API key
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY is not set")
            
            # Extract from resume
            print("  [EXTRACTING] Extracting candidate skills from resume...")
            candidate_skills = self.extract_skills_with_llm(
                state["resume_text"],
                "This is a candidate's resume. Extract their demonstrated skills."
            )
            
            # Extract from job description
            print("  [EXTRACTING] Extracting required skills from job description...")
            required_skills = self.extract_skills_with_llm(
                state["job_description"],
                "This is a job description. Extract required skills and qualifications."
            )
            
            print(f"  [SUCCESS] Found {len(candidate_skills)} candidate skills")
            print(f"  [SUCCESS] Found {len(required_skills)} required skills")
            
            # Update state
            state["candidate_skills"] = candidate_skills
            state["required_skills"] = required_skills
            state["extraction_status"] = "completed"
            
            # Print sample results
            if candidate_skills:
                print(f"  [SAMPLE] Sample candidate skills: {[s.get('name', s.get('skill', s.get('title', 'unknown'))) for s in candidate_skills[:5]]}")
            if required_skills:
                print(f"  [SAMPLE] Sample required skills: {[s.get('name', s.get('skill', s.get('title', 'unknown'))) for s in required_skills[:5]]}")
            
        except ValueError as ve:
            print(f"  [ERROR] Configuration Error: {str(ve)}")
            state["extraction_status"] = "failed"
            state["errors"] = [f"SkillExtractor: Configuration error - {str(ve)}"]
            
        except Exception as e:
            error_msg = str(e)
            if "Connection" in error_msg or "API" in error_msg:
                print(f"  [ERROR] API Connection Error: {error_msg}")
                state["errors"] = [f"SkillExtractor: API connection failed. Please check your GROQ_API_KEY and internet connection."]
            else:
                print(f"  [ERROR] Error in Skill Extractor: {error_msg}")
                state["errors"] = [f"SkillExtractor: {error_msg}"]
            
            state["extraction_status"] = "failed"
        
        return state