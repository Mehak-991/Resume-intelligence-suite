"""
Agent 2: Gap Calculator
Analyzes skill gaps between candidate and job requirements
Calculates proficiency gaps and categorizes them by severity
"""

import os
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
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
            # Safe access to skill name with fallback
            skill_name = skill.get('name') or skill.get('skill') or skill.get('title')
            if not skill_name:
                continue  # Skip invalid skill objects
            skill['name'] = skill_name  # Ensure 'name' key exists
            normalized = self.normalize_skill_name(skill_name)
            
            # If we haven't seen this skill, or if this one has higher proficiency
            proficiency = skill.get('proficiency', 0)
            if normalized not in seen or proficiency > seen[normalized].get('proficiency', 0):
                if normalized in seen:
                    # Remove the old one
                    unique_skills = [s for s in unique_skills if self.normalize_skill_name(s.get('name', s.get('skill', s.get('title', '')))) != normalized]
                
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
        candidate_skill_names = [s.get('name', s.get('skill', s.get('title', ''))) for s in candidate_skills]
        
        for req_skill in required_skills:
            is_covered = False
            req_skill_name = req_skill.get('name', req_skill.get('skill', req_skill.get('title', '')))
            if not req_skill_name:
                continue
            req_skill['name'] = req_skill_name
            
            # Check if any candidate skill is a parent of this required skill
            for cand_skill_name in candidate_skill_names:
                if cand_skill_name and self.is_child_skill(req_skill_name, cand_skill_name):
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
        candidate_map = {}
        for s in candidate_skills:
            skill_name = s.get('name', s.get('skill', s.get('title', '')))
            if skill_name:
                s['name'] = skill_name
                candidate_map[self.normalize_skill_name(skill_name)] = s
        
        required_map = {}
        for s in required_skills:
            skill_name = s.get('name', s.get('skill', s.get('title', '')))
            if skill_name:
                s['name'] = skill_name
                required_map[self.normalize_skill_name(skill_name)] = s
        
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
            
            req_skill_actual_name = req_skill.get('name') or req_skill.get('skill') or req_skill.get('title') or req_skill_name
            
            if matched_cand_skill:
                req_proficiency = req_skill.get('proficiency', req_skill.get('level', 5.0))
                cand_proficiency = matched_cand_skill.get('proficiency', matched_cand_skill.get('level', 5.0))
                proficiency_gap = float(req_proficiency) - float(cand_proficiency)
                
                # Determine gap severity
                if proficiency_gap <= 0:
                    # Candidate meets or exceeds requirement
                    strong_skills.append(req_skill_actual_name)
                elif proficiency_gap <= 2:
                    # Minor gap
                    weak_skills.append(req_skill_actual_name)
                    gaps.append({
                        'skill': req_skill_actual_name,
                        'importance': float(req_proficiency),
                        'current_proficiency': float(cand_proficiency),
                        'required_proficiency': float(req_proficiency),
                        'gap_severity': 'low'
                    })
                    processed_gaps.add(skill_key)
                elif proficiency_gap <= 4:
                    # Moderate gap
                    weak_skills.append(req_skill_actual_name)
                    gaps.append({
                        'skill': req_skill_actual_name,
                        'importance': float(req_proficiency),
                        'current_proficiency': float(cand_proficiency),
                        'required_proficiency': float(req_proficiency),
                        'gap_severity': 'medium'
                    })
                    processed_gaps.add(skill_key)
                else:
                    # Major gap
                    weak_skills.append(req_skill_actual_name)
                    gaps.append({
                        'skill': req_skill_actual_name,
                        'importance': float(req_proficiency),
                        'current_proficiency': float(cand_proficiency),
                        'required_proficiency': float(req_proficiency),
                        'gap_severity': 'high'
                    })
                    processed_gaps.add(skill_key)
            else:
                # Skill is completely missing
                missing_skills.append(req_skill_actual_name)
                req_proficiency = req_skill.get('proficiency', req_skill.get('level', 5.0))
                gaps.append({
                    'skill': req_skill_actual_name,
                    'importance': float(req_proficiency),
                    'current_proficiency': 0.0,
                    'required_proficiency': float(req_proficiency),
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
        
        # Use direct messages — NOT ChatPromptTemplate — because json.dumps() output
        # contains braces that str.format() would interpret as template variables.
        system_msg = SystemMessage(content=(
            "You are an expert career coach analyzing skill gaps.\n"
            "Given the identified gaps, provide enhanced analysis with:\n"
            "1. Importance ranking (0-10) based on job requirements\n"
            "2. Learning difficulty assessment\n"
            "3. Transferable skills the candidate might leverage\n"
            "Return the enhanced gaps as JSON array with the same structure plus your insights."
        ))
        user_content = (
            f"Resume: {resume_text[:500]}...\n"
            f"Job Description: {job_text[:500]}...\n"
            f"Identified Gaps: {json.dumps(gaps[:10])}\n\n"
            "Enhance these gaps with importance and context."
        )
        human_msg = HumanMessage(content=user_content)
        
        try:
            response = self.llm.invoke([system_msg, human_msg])
            enhanced = json.loads(response.content)
            return enhanced if isinstance(enhanced, list) else gaps
        except:
            return gaps
            
    def validate_skills_schema(self, skills: List[Dict]) -> List[Dict]:
        """Validate and normalise skill items to match the expected schema precisely"""
        valid_skills = []
        if not isinstance(skills, list):
            return []
            
        for item in skills:
            if not isinstance(item, dict):
                continue
                
            skill_name = item.get('name') or item.get('skill') or item.get('title')
            if not skill_name or not isinstance(skill_name, str):
                continue
                
            proficiency = item.get('proficiency')
            if proficiency is None:
                proficiency = item.get('level')
            if proficiency is None:
                proficiency = 5.0
                
            try:
                proficiency = float(proficiency)
            except:
                proficiency = 5.0
                
            category = item.get('category') or item.get('type') or 'general'
            
            valid_skills.append({
                "name": skill_name.strip(),
                "proficiency": min(max(proficiency, 0.0), 10.0),
                "category": str(category).strip()
            })
            
        return valid_skills
    
    def __call__(self, state: AgentState) -> AgentState:
        """
        Main agent execution
        Calculates gaps between candidate and required skills
        """
        print("\n[CHART] AGENT 2: Gap Calculator - Starting...")
        
        try:
            # Check if previous agent completed
            if state.get("extraction_status") != "completed":
                print(f"  [ERROR] Skill extraction not completed, status: {state.get('extraction_status')}")
                raise Exception("Skill extraction not completed")
            
            # Validate input schemas safely before processing
            candidate_skills = self.validate_skills_schema(state.get("candidate_skills", []))
            required_skills = self.validate_skills_schema(state.get("required_skills", []))
            
            # Update state with normalized schema structures
            state["candidate_skills"] = candidate_skills
            state["required_skills"] = required_skills
            
            # Validate skills exist
            if not candidate_skills and not required_skills:
                print(f"  [ERROR] No skills to analyze - candidate: {len(candidate_skills)}, required: {len(required_skills)}")
                raise Exception("No skills available for gap analysis")
            
            print(f"  [INPUT] Raw input: {len(candidate_skills)} candidate skills, {len(required_skills)} required skills")
            
            # Calculate gaps (with deduplication and filtering)
            gap_analysis = self.calculate_gaps(candidate_skills, required_skills)
            
            print(f"  [SUCCESS] After deduplication: {len(gap_analysis['gaps'])} unique skill gaps")
            print(f"  [SUCCESS] Strong skills: {len(gap_analysis['strong_skills'])}")
            print(f"  [SUCCESS] Weak skills: {len(gap_analysis['weak_skills'])}")
            print(f"  [SUCCESS] Missing skills: {len(gap_analysis['missing_skills'])}")
            
            # Update state
            state["skill_gaps"] = gap_analysis['gaps']
            state["strong_skills"] = gap_analysis['strong_skills']
            state["weak_skills"] = gap_analysis['weak_skills']
            state["missing_skills"] = gap_analysis['missing_skills']
            state["gap_analysis_status"] = "completed"
            
            # Print critical gaps
            critical_gaps = [g for g in gap_analysis['gaps'] if g.get('gap_severity') == 'critical']
            if critical_gaps:
                print(f"  [WARNING] Critical gaps: {[g.get('skill', 'unknown') for g in critical_gaps[:5]]}")
            
        except Exception as e:
            print(f"  [ERROR] Error in Gap Calculator: {str(e)}")
            state["gap_analysis_status"] = "failed"
            state["errors"] = state.get("errors", []) + [f"GapCalculator: {str(e)}"]
        
        return state