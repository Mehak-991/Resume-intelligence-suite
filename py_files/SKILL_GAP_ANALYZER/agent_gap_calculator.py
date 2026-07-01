"""
Agent 2: Gap Calculator
Analyzes skill gaps between candidate and job requirements
Calculates proficiency gaps and categorizes them by severity
"""

import os
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from state import AgentState, SkillGap
import json


class GapCalculatorAgent:
    """
    Calculates skill gaps and categorizes them by severity
    """
    
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.llm = ChatGroq(
            api_key=self.groq_api_key,
            model="llama-3.3-70b-versatile",
            temperature=0.1
        )
        
        # Define skill hierarchies (parent skills cover child skills)
        self.skill_hierarchy = {
            "Computer Vision": ["Object Detection", "Image Classification", "Image Segmentation", "Facial Recognition"],
            "Machine Learning": ["Deep Learning", "Supervised Learning", "Unsupervised Learning", "Reinforcement Learning"],
            "Deep Learning": ["Neural Networks", "CNN", "RNN", "Transformers"],
            "Python": ["NumPy", "Pandas", "Matplotlib"],
            "Data Science": ["Data Analysis", "Data Preprocessing", "Data Visualization"],
            "DevOps": ["Docker", "Kubernetes", "CI/CD"],
            "Cloud Computing": ["AWS", "Azure", "GCP"],
        }
    
    def normalize_skill_name(self, skill_name: str) -> str:
        """Normalize skill names for better matching"""
        return skill_name.strip().lower()
    
    def deduplicate_skills(self, skills: List[Dict]) -> List[Dict]:
        """Remove duplicate skills based on normalized names"""
        seen = {}
        unique_skills = []
        
        for skill in skills:
            normalized = self.normalize_skill_name(skill['name'])
            
            # If we haven't seen this skill, or if this one has higher proficiency
            if normalized not in seen or skill['proficiency'] > seen[normalized]['proficiency']:
                if normalized in seen:
                    # Remove the old one
                    unique_skills = [s for s in unique_skills if self.normalize_skill_name(s['name']) != normalized]
                
                seen[normalized] = skill
                unique_skills.append(skill)
        
        return unique_skills
    
    def is_child_skill(self, child_skill: str, parent_skill: str) -> bool:
        """Check if child_skill is covered by parent_skill"""
        parent_normalized = self.normalize_skill_name(parent_skill)
        child_normalized = self.normalize_skill_name(child_skill)
        
        # Check in hierarchy
        for parent, children in self.skill_hierarchy.items():
            if self.normalize_skill_name(parent) == parent_normalized:
                for child in children:
                    if self.normalize_skill_name(child) == child_normalized:
                        return True
        
        return False
    
    def filter_redundant_skills(self, required_skills: List[Dict], candidate_skills: List[Dict]) -> List[Dict]:
        """
        Remove required skills that are already covered by candidate's parent skills
        Example: If candidate has "Computer Vision", don't require "Object Detection"
        """
        filtered_required = []
        candidate_skill_names = [s['name'] for s in candidate_skills]
        
        for req_skill in required_skills:
            is_covered = False
            
            # Check if any candidate skill is a parent of this required skill
            for cand_skill_name in candidate_skill_names:
                if self.is_child_skill(req_skill['name'], cand_skill_name):
                    is_covered = True
                    break
            
            if not is_covered:
                filtered_required.append(req_skill)
        
        return filtered_required
    
    def calculate_gaps(self, candidate_skills: List[Dict], required_skills: List[Dict]) -> Dict:
        """Calculate skill gaps using intelligent matching"""
        
        # Deduplicate skills first
        candidate_skills = self.deduplicate_skills(candidate_skills)
        required_skills = self.deduplicate_skills(required_skills)
        
        # Filter out redundant required skills covered by parent skills
        required_skills = self.filter_redundant_skills(required_skills, candidate_skills)
        
        # Create skill name mappings for fuzzy matching
        candidate_map = {self.normalize_skill_name(s['name']): s for s in candidate_skills}
        required_map = {self.normalize_skill_name(s['name']): s for s in required_skills}
        
        gaps = []
        strong_skills = []
        weak_skills = []
        missing_skills = []
        
        # Track processed skills to avoid duplicates
        processed_gaps = set()
        
        # Analyze each required skill
        for req_skill_name, req_skill in required_map.items():
            skill_key = req_skill_name  # Use normalized name as key
            
            # Skip if already processed
            if skill_key in processed_gaps:
                continue
            
            # Check if candidate has this skill using fuzzy matching (substring search)
            matched_cand_skill = None
            if req_skill_name in candidate_map:
                matched_cand_skill = candidate_map[req_skill_name]
            else:
                # Try soft / substring matching in case of comma-combined names like "Web Development, HTML"
                for cand_name, cand_skill in candidate_map.items():
                    if req_skill_name in cand_name or cand_name in req_skill_name:
                        matched_cand_skill = cand_skill
                        break
            
            if matched_cand_skill:
                proficiency_gap = req_skill['proficiency'] - matched_cand_skill['proficiency']
                
                # Determine gap severity
                if proficiency_gap <= 0:
                    # Candidate meets or exceeds requirement
                    strong_skills.append(req_skill['name'])
                elif proficiency_gap <= 2:
                    # Minor gap
                    weak_skills.append(req_skill['name'])
                    gaps.append({
                        'skill': req_skill['name'],
                        'importance': req_skill['proficiency'],
                        'current_proficiency': matched_cand_skill['proficiency'],
                        'required_proficiency': req_skill['proficiency'],
                        'gap_severity': 'low'
                    })
                    processed_gaps.add(skill_key)
                elif proficiency_gap <= 4:
                    # Moderate gap
                    weak_skills.append(req_skill['name'])
                    gaps.append({
                        'skill': req_skill['name'],
                        'importance': req_skill['proficiency'],
                        'current_proficiency': matched_cand_skill['proficiency'],
                        'required_proficiency': req_skill['proficiency'],
                        'gap_severity': 'medium'
                    })
                    processed_gaps.add(skill_key)
                else:
                    # Major gap
                    weak_skills.append(req_skill['name'])
                    gaps.append({
                        'skill': req_skill['name'],
                        'importance': req_skill['proficiency'],
                        'current_proficiency': matched_cand_skill['proficiency'],
                        'required_proficiency': req_skill['proficiency'],
                        'gap_severity': 'high'
                    })
                    processed_gaps.add(skill_key)
            else:
                # Skill is completely missing
                missing_skills.append(req_skill['name'])
                gaps.append({
                    'skill': req_skill['name'],
                    'importance': req_skill['proficiency'],
                    'current_proficiency': 0.0,
                    'required_proficiency': req_skill['proficiency'],
                    'gap_severity': 'critical'
                })
                processed_gaps.add(skill_key)
        
        # Remove duplicates from lists
        strong_skills = list(set(strong_skills))
        weak_skills = list(set(weak_skills))
        missing_skills = list(set(missing_skills))
        
        return {
            'gaps': gaps,
            'strong_skills': strong_skills,
            'weak_skills': weak_skills,
            'missing_skills': missing_skills
        }
    
    def enhance_gap_analysis(self, gaps: List[Dict], resume_text: str, job_text: str) -> List[Dict]:
        """Use LLM to enhance gap analysis with context"""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert career coach analyzing skill gaps.
Given the identified gaps, provide enhanced analysis with:
1. Importance ranking (0-10) based on job requirements
2. Learning difficulty assessment
3. Transferable skills the candidate might leverage

Return the enhanced gaps as JSON array with the same structure plus your insights."""),
            ("user", f"""Resume: {resume_text[:500]}...
Job Description: {job_text[:500]}...
Identified Gaps: {json.dumps(gaps[:10])}

Enhance these gaps with importance and context.""")
        ])
        
        try:
            response = self.llm.invoke(prompt.format_messages())
            enhanced = json.loads(response.content)
            return enhanced if isinstance(enhanced, list) else gaps
        except:
            return gaps
    
    def __call__(self, state: AgentState) -> AgentState:
        """
        Main agent execution
        Calculates gaps between candidate and required skills
        """
        print("\n📊 AGENT 2: Gap Calculator - Starting...")
        
        try:
            # Check if previous agent completed
            if state.get("extraction_status") != "completed":
                raise Exception("Skill extraction not completed")
            
            candidate_skills = state["candidate_skills"]
            required_skills = state["required_skills"]
            
            print(f"  → Raw input: {len(candidate_skills)} candidate skills, {len(required_skills)} required skills")
            
            # Calculate gaps (with deduplication and filtering)
            gap_analysis = self.calculate_gaps(candidate_skills, required_skills)
            
            print(f"  ✓ After deduplication: {len(gap_analysis['gaps'])} unique skill gaps")
            print(f"  ✓ Strong skills: {len(gap_analysis['strong_skills'])}")
            print(f"  ✓ Weak skills: {len(gap_analysis['weak_skills'])}")
            print(f"  ✓ Missing skills: {len(gap_analysis['missing_skills'])}")
            
            # Update state
            state["skill_gaps"] = gap_analysis['gaps']
            state["strong_skills"] = gap_analysis['strong_skills']
            state["weak_skills"] = gap_analysis['weak_skills']
            state["missing_skills"] = gap_analysis['missing_skills']
            state["gap_analysis_status"] = "completed"
            
            # Print critical gaps
            critical_gaps = [g for g in gap_analysis['gaps'] if g['gap_severity'] == 'critical']
            if critical_gaps:
                print(f"  ⚠️  Critical gaps: {[g['skill'] for g in critical_gaps[:5]]}")
            
        except Exception as e:
            print(f"  ✗ Error in Gap Calculator: {str(e)}")
            state["gap_analysis_status"] = "failed"
            state["errors"] = state.get("errors", []) + [f"GapCalculator: {str(e)}"]
        
        return state