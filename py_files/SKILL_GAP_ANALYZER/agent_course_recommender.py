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
    Uses web search to find free courses
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
    
    def find_courses_for_skill(self, skill: str, current_level: float, target_level: float) -> List[CourseRecommendation]:
        """Find courses for a specific skill"""
        
        # Determine difficulty level needed
        if current_level == 0:
            level = "beginner"
        elif current_level < 5:
            level = "intermediate"
        else:
            level = "advanced"
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert online learning advisor.
For the given skill and level, recommend 2-3 high-quality FREE courses.

Focus on:
- Coursera, edX, freeCodeCamp, YouTube playlists, Udacity free tier
- Official documentation and tutorials
- Reputable platforms with certificates

Return ONLY valid JSON array:
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
            ("user", f"Find FREE courses for: {skill}\nCurrent level: {current_level}/10\nTarget level: {target_level}/10\nRecommended difficulty: {level}")
        ])
        
        try:
            response = self.llm.invoke(prompt.format_messages())
            
            # Parse JSON response
            try:
                courses = json.loads(response.content)
                return courses if isinstance(courses, list) else []
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
                if json_match:
                    courses = json.loads(json_match.group())
                    return courses if isinstance(courses, list) else []
                else:
                    return []
        except Exception as e:
            print(f"  ⚠️  Error finding courses for {skill}: {str(e)}")
            return []
    
    def create_learning_roadmap(self, gaps: List[Dict], courses: List[CourseRecommendation]) -> Dict:
        """Organize courses into a prioritized learning roadmap"""
        
        # Group courses by skill (deduplicate within each skill)
        roadmap = {}
        for course in courses:
            skill = course['skill']
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
            skill = gap['skill']
            if skill in roadmap:
                prioritized_roadmap[skill] = roadmap[skill]
        
        return prioritized_roadmap
    
    def __call__(self, state: AgentState) -> AgentState:
        """
        Main agent execution
        Finds courses for all identified skill gaps
        """
        print("\n📚 AGENT 3: Course Recommender - Starting...")
        
        try:
            # Check if previous agent completed
            if state.get("gap_analysis_status") != "completed":
                raise Exception("Gap analysis not completed")
            
            skill_gaps = state["skill_gaps"]
            
            # Remove duplicate gaps
            unique_gaps = []
            seen_skills = set()
            for gap in skill_gaps:
                if gap['skill'] not in seen_skills:
                    unique_gaps.append(gap)
                    seen_skills.add(gap['skill'])
            
            print(f"  → Finding courses for {len(unique_gaps)} unique skill gaps...")
            
            all_courses = []
            total_time = 0
            
            # Find courses for each gap (limit to top 10 critical/high priority)
            priority_gaps = [g for g in unique_gaps if g['gap_severity'] in ['critical', 'high']][:10]
            
            for i, gap in enumerate(priority_gaps, 1):
                print(f"  → [{i}/{len(priority_gaps)}] Finding courses for {gap['skill']}...")
                
                courses = self.find_courses_for_skill(
                    gap['skill'],
                    gap['current_proficiency'],
                    gap['required_proficiency']
                )
                
                all_courses.extend(courses)
                total_time += sum(c.get('duration_hours', 0) for c in courses)
            
            # Deduplicate all courses
            all_courses = self.deduplicate_courses(all_courses)
            
            # Recalculate total time after deduplication
            total_time = sum(c.get('duration_hours', 0) for c in all_courses)
            
            print(f"  ✓ Found {len(all_courses)} unique course recommendations")
            print(f"  ✓ Total estimated learning time: {total_time:.1f} hours ({total_time/40:.1f} weeks at 40h/week)")
            
            # Create learning roadmap
            roadmap = self.create_learning_roadmap(unique_gaps, all_courses)
            
            # Update state
            state["course_recommendations"] = all_courses
            state["learning_roadmap"] = roadmap
            state["total_learning_time"] = total_time
            state["recommendation_status"] = "completed"
            
            # Print sample recommendations
            if all_courses:
                print(f"  → Sample courses: {[c['course_title'][:50] for c in all_courses[:3]]}")
            
        except Exception as e:
            print(f"  ✗ Error in Course Recommender: {str(e)}")
            state["recommendation_status"] = "failed"
            state["errors"] = state.get("errors", []) + [f"CourseRecommender: {str(e)}"]
        
        return state