"""
Agent 3: Course Recommender
Finds free courses for identified skill gaps
Estimates learning time and creates learning roadmap
"""

import os
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from state import AgentState, CourseRecommendation
import json


class CourseRecommenderAgent:
    """
    Recommends courses for skill gaps
    Uses batch Groq LLM query to find free courses for all gaps at once
    """
    
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.llm = ChatGroq(
            api_key=self.groq_api_key,
            model="llama-3.3-70b-versatile",
            temperature=0.3
        )
    
    def deduplicate_courses(self, courses: List[Dict]) -> List[Dict]:
        """Remove duplicate courses based on title and URL"""
        seen_urls = set()
        seen_titles = set()
        unique_courses = []
        
        for course in courses:
            course_url = course.get('url', '').lower()
            course_title = course.get('course_title', '').lower()
            
            # Check if we've seen this URL or exact title
            if course_url not in seen_urls and course_title not in seen_titles:
                seen_urls.add(course_url)
                seen_titles.add(course_title)
                unique_courses.append(course)
        
        return unique_courses
    
    def find_courses_for_skills_batch(self, skills_list: List[Dict]) -> List[CourseRecommendation]:
        """Find courses for multiple skills in a single LLM call to save time and reduce latency"""
        if not skills_list:
            return []
            
        formatted_skills = []
        for gap in skills_list:
            current_level = gap['current_proficiency']
            if current_level == 0:
                level = "beginner"
            elif current_level < 5:
                level = "intermediate"
            else:
                level = "advanced"
            formatted_skills.append({
                "skill": gap.get('skill', 'unknown'),
                "current_level": f"{current_level}/10",
                "target_level": f"{gap['required_proficiency']}/10",
                "recommended_difficulty": level
            })
            
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert online learning advisor.
For each given skill and level, recommend 2-3 high-quality FREE courses.

Focus on:
- Coursera, edX, freeCodeCamp, YouTube playlists, Udacity free tier
- Official documentation and tutorials
- Reputable platforms with certificates

Return ONLY valid JSON array with this exact structure, containing NO markdown backticks or explanations:
[
  {{
    "skill": "Python",
    "course_title": "Python for Everybody",
    "platform": "Coursera",
    "url": "https://www.coursera.org/specializations/python",
    "duration_hours": 35,
    "level": "beginner",
    "is_free": true
  }}
]"""),
            ("user", f"Find FREE courses for the following skills:\n{json.dumps(formatted_skills, indent=2)}")
        ])
        
        try:
            response = self.llm.invoke(prompt.format_messages())
            content = response.content.strip()
            
            # Parse JSON response
            try:
                courses = json.loads(content)
                return courses if isinstance(courses, list) else []
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    courses = json.loads(json_match.group())
                    return courses if isinstance(courses, list) else []
                else:
                    return []
        except Exception as e:
            print(f"  [WARNING] Error finding courses in batch: {str(e)}")
            return []

    def find_courses_for_skill(self, skill: str, current_level: float, target_level: float) -> List[CourseRecommendation]:
        """Find courses for a single skill (Legacy / Fallback)"""
        # Kept for compatibility, but we now prefer find_courses_for_skills_batch
        return self.find_courses_for_skills_batch([{
            'skill': skill,
            'current_proficiency': current_level,
            'required_proficiency': target_level
        }])
    
    def create_learning_roadmap(self, gaps: List[Dict], courses: List[CourseRecommendation]) -> Dict:
        """Organize courses into a prioritized learning roadmap"""
        
        # Group courses by skill (deduplicate within each skill)
        roadmap = {}
        for course in courses:
            skill = course.get('skill', 'unknown')
            if not skill:
                continue
            if skill not in roadmap:
                roadmap[skill] = []
            roadmap[skill].append(course)
        
        # Deduplicate courses within each skill
        for skill in roadmap:
            roadmap[skill] = self.deduplicate_courses(roadmap[skill])
        
        # Sort by gap severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        sorted_gaps = sorted(gaps, key=lambda x: severity_order.get(x['gap_severity'], 4))
        
        # Reorder roadmap by priority
        prioritized_roadmap = {}
        for gap in sorted_gaps:
            skill = gap.get('skill', 'unknown')
            if skill in roadmap:
                prioritized_roadmap[skill] = roadmap[skill]
        
        return prioritized_roadmap
    
    def __call__(self, state: AgentState) -> AgentState:
        """
        Main agent execution
        Finds courses for all identified skill gaps
        """
        print("\n[BOOK] AGENT 3: Course Recommender - Starting...")
        
        try:
            # Check if previous agent completed
            if state.get("gap_analysis_status") != "completed":
                raise Exception("Gap analysis not completed")
            
            skill_gaps = state["skill_gaps"]
            
            # Remove duplicate gaps
            unique_gaps = []
            seen_skills = set()
            for gap in skill_gaps:
                gap_skill = gap.get('skill', 'unknown')
                if gap_skill not in seen_skills:
                    unique_gaps.append(gap)
                    seen_skills.add(gap_skill)
            
            print(f"  [SEARCHING] Finding courses for {len(unique_gaps)} unique skill gaps...")
            
            # Find courses for each gap (limit to top 10 critical/high priority)
            priority_gaps = [g for g in unique_gaps if g['gap_severity'] in ['critical', 'high']][:10]
            
            print(f"  [REQUESTING] Requesting batch recommendations for {len(priority_gaps)} priority gaps...")
            all_courses = self.find_courses_for_skills_batch(priority_gaps)
            
            # Deduplicate all courses
            all_courses = self.deduplicate_courses(all_courses)
            
            # Recalculate total time after deduplication
            total_time = sum(c.get('duration_hours', 0) for c in all_courses)
            
            print(f"  [SUCCESS] Found {len(all_courses)} unique course recommendations")
            print(f"  [SUCCESS] Total estimated learning time: {total_time:.1f} hours ({total_time/40:.1f} weeks at 40h/week)")
            
            # Create learning roadmap
            roadmap = self.create_learning_roadmap(unique_gaps, all_courses)
            
            # Update state
            state["course_recommendations"] = all_courses
            state["learning_roadmap"] = roadmap
            state["total_learning_time"] = total_time
            state["recommendation_status"] = "completed"
            
            # Print sample recommendations
            if all_courses:
                print(f"  [SAMPLE] Sample courses: {[c.get('course_title', 'unknown')[:50] for c in all_courses[:3]]}")
            
        except Exception as e:
            print(f"  [ERROR] Error in Course Recommender: {str(e)}")
            state["recommendation_status"] = "failed"
            state["errors"] = state.get("errors", []) + [f"CourseRecommender: {str(e)}"]
        
        return state