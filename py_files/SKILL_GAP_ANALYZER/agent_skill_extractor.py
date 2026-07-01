"""
Agent 1: Skill Extractor
Uses spaCy NER + Groq LLM to extract skills from resume and job description
"""

import os
import spacy
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from state import AgentState, SkillItem
import json
import time


class SkillExtractorAgent:
    """
    Extracts technical skills from resume and job description
    Uses spaCy for initial NER and Groq for enhanced extraction
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
        
        # Load spaCy model for NER
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            print("Downloading spaCy model...")
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")
    
    def extract_with_spacy(self, text: str) -> List[str]:
        """Use spaCy NER to extract potential skills"""
        doc = self.nlp(text)
        
        # Extract organizations, products, and technical terms
        skills = []
        for ent in doc.ents:
            if ent.label_ in ["ORG", "PRODUCT", "GPE"]:
                skills.append(ent.text)
        
        # Also look for capitalized technical terms
        for token in doc:
            if token.is_alpha and token.text[0].isupper() and len(token.text) > 2:
                skills.append(token.text)
        
        return list(set(skills))
    
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
  {{"name": "Python", "proficiency": 8.5, "category": "programming"}},
  {{"name": "Kubernetes", "proficiency": 6.0, "category": "devops"}}
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
                    return skills_data
                except json.JSONDecodeError:
                    # Fallback: try to extract JSON from response
                    import re
                    json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
                    if json_match:
                        skills_data = json.loads(json_match.group())
                        return skills_data
                    else:
                        raise ValueError("Could not parse JSON from LLM response")
                        
            except Exception as e:
                print(f"  ⚠️  Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
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
        print("\n🔍 AGENT 1: Skill Extractor - Starting...")
        
        try:
            # Validate API key
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY is not set")
            
            # Extract from resume
            print("  → Extracting candidate skills from resume...")
            candidate_skills = self.extract_skills_with_llm(
                state["resume_text"],
                "This is a candidate's resume. Extract their demonstrated skills."
            )
            
            # Extract from job description
            print("  → Extracting required skills from job description...")
            required_skills = self.extract_skills_with_llm(
                state["job_description"],
                "This is a job description. Extract required skills and qualifications."
            )
            
            print(f"  ✓ Found {len(candidate_skills)} candidate skills")
            print(f"  ✓ Found {len(required_skills)} required skills")
            
            # Update state
            state["candidate_skills"] = candidate_skills
            state["required_skills"] = required_skills
            state["extraction_status"] = "completed"
            
            # Print sample results
            if candidate_skills:
                print(f"  → Sample candidate skills: {[s['name'] for s in candidate_skills[:5]]}")
            if required_skills:
                print(f"  → Sample required skills: {[s['name'] for s in required_skills[:5]]}")
            
        except ValueError as ve:
            print(f"  ✗ Configuration Error: {str(ve)}")
            state["extraction_status"] = "failed"
            state["errors"] = [f"SkillExtractor: Configuration error - {str(ve)}"]
            
        except Exception as e:
            error_msg = str(e)
            if "Connection" in error_msg or "API" in error_msg:
                print(f"  ✗ API Connection Error: {error_msg}")
                state["errors"] = [f"SkillExtractor: API connection failed. Please check your GROQ_API_KEY and internet connection."]
            else:
                print(f"  ✗ Error in Skill Extractor: {error_msg}")
                state["errors"] = [f"SkillExtractor: {error_msg}"]
            
            state["extraction_status"] = "failed"
        
        return state