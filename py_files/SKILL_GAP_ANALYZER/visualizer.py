"""
Visualization Generator
Creates radar charts, gap charts, and learning roadmap timeline
"""

import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import List, Dict
import os


class SkillGapVisualizer:
    """
    Creates interactive visualizations for skill gap analysis
    """
    
    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def create_radar_chart(self, candidate_skills: List[Dict], required_skills: List[Dict]) -> str:
        """Create radar chart comparing candidate vs required skills"""
        
        # Get common skills for comparison
        candidate_map = {
            (s.get('name') or s.get('skill') or s.get('title') or 'unknown'): 
            s.get('proficiency', s.get('level', 5.0)) 
            for s in candidate_skills if isinstance(s, dict)
        }
        required_map = {
            (s.get('name') or s.get('skill') or s.get('title') or 'unknown'): 
            s.get('proficiency', s.get('level', 5.0)) 
            for s in required_skills if isinstance(s, dict)
        }
        
        # Find skills to compare (top 8 required skills)
        skills_to_compare = sorted(
            required_skills,
            key=lambda x: x.get('proficiency', x.get('level', 0.0)) if isinstance(x, dict) else 0.0,
            reverse=True
        )[:8]
        
        categories = [s.get('name', s.get('skill', s.get('title', 'unknown'))) for s in skills_to_compare if isinstance(s, dict)]
        candidate_values = [candidate_map.get(cat, 0.0) for cat in categories]
        required_values = [required_map.get(cat, 0.0) for cat in categories]
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatterpolar(
            r=required_values,
            theta=categories,
            fill='toself',
            name='Required',
            line_color='rgb(255, 99, 71)',
            fillcolor='rgba(255, 99, 71, 0.2)'
        ))
        
        fig.add_trace(go.Scatterpolar(
            r=candidate_values,
            theta=categories,
            fill='toself',
            name='Your Skills',
            line_color='rgb(50, 205, 50)',
            fillcolor='rgba(50, 205, 50, 0.2)'
        ))
        
        fig.update_layout(
            polar=dict(
                radialaxis=dict(visible=True, range=[0, 10])
            ),
            showlegend=True,
            title="Skill Proficiency Comparison",
            height=600
        )
        
        output_path = os.path.join(self.output_dir, "radar_chart.html")
        fig.write_html(output_path)
        
        return output_path
    
    def create_gap_severity_chart(self, skill_gaps: List[Dict]) -> str:
        """Create bar chart showing gap severity"""
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        sorted_gaps = sorted(
            skill_gaps, 
            key=lambda x: severity_order.get(x.get('gap_severity', 'low') if isinstance(x, dict) else 'low', 4)
        )[:15]
        
        skills = [g.get('skill', g.get('name', 'unknown')) for g in sorted_gaps if isinstance(g, dict)]
        gap_values = [
            float(g.get('required_proficiency', g.get('required', 0.0))) - 
            float(g.get('current_proficiency', g.get('current', 0.0))) 
            for g in sorted_gaps if isinstance(g, dict)
        ]
        colors = []
        
        for g in sorted_gaps:
            if not isinstance(g, dict):
                colors.append('rgb(76, 175, 80)')
                continue
            severity = g.get('gap_severity', 'low')
            if severity == 'critical':
                colors.append('rgb(220, 53, 69)')
            elif severity == 'high':
                colors.append('rgb(255, 193, 7)')
            elif severity == 'medium':
                colors.append('rgb(255, 235, 59)')
            else:
                colors.append('rgb(76, 175, 80)')
        
        fig = go.Figure([go.Bar(
            x=gap_values,
            y=skills,
            orientation='h',
            marker_color=colors,
            text=[f"{v:.1f}" for v in gap_values],
            textposition='auto'
        )])
        
        fig.update_layout(
            title="Skill Gap Analysis (Proficiency Gap)",
            xaxis_title="Proficiency Gap (0-10)",
            yaxis_title="Skills",
            height=600,
            showlegend=False
        )
        
        output_path = os.path.join(self.output_dir, "gap_analysis.html")
        fig.write_html(output_path)
        
        return output_path
    
    def create_learning_roadmap(self, roadmap: Dict, total_hours: float) -> str:
        """Create timeline visualization for learning roadmap"""
        
        # Prepare data for Gantt-like chart
        tasks = []
        start_week = 0
        
        for skill, courses in roadmap.items():
            if not isinstance(courses, list):
                continue
            for course in courses:
                if not isinstance(course, dict):
                    continue
                duration_weeks = course.get('duration_hours', 10.0) / 10.0  # 10 hours per week
                tasks.append({
                    'Skill': skill,
                    'Course': str(course.get('course_title', 'unknown'))[:40],
                    'Start': start_week,
                    'Duration': duration_weeks,
                    'Platform': str(course.get('platform', 'unknown'))
                })
                start_week += duration_weeks
        
        # Limit to first 15 courses
        tasks = tasks[:15]
        
        fig = go.Figure()
        
        colors = px.colors.qualitative.Set3
        
        for i, task in enumerate(tasks):
            fig.add_trace(go.Bar(
                y=[task['Course']],
                x=[task['Duration']],
                orientation='h',
                name=task['Skill'],
                marker_color=colors[i % len(colors)],
                text=f"{task['Duration']:.1f}w",
                textposition='inside',
                hovertemplate=f"<b>{task['Course']}</b><br>Skill: {task['Skill']}<br>Duration: {task['Duration']:.1f} weeks<br>Platform: {task['Platform']}<extra></extra>"
            ))
        
        fig.update_layout(
            title=f"Learning Roadmap Timeline (Total: {total_hours:.0f} hours ≈ {total_hours/40:.1f} weeks)",
            xaxis_title="Weeks",
            yaxis_title="Courses",
            barmode='stack',
            height=800,
            showlegend=False
        )
        
        output_path = os.path.join(self.output_dir, "learning_roadmap.html")
        fig.write_html(output_path)
        
        return output_path
    
    def create_category_breakdown(self, candidate_skills: List[Dict], required_skills: List[Dict]) -> str:
        """Create pie chart showing skill category breakdown"""
        
        # Count skills by category
        required_categories = {}
        for skill in required_skills:
            if not isinstance(skill, dict):
                continue
            cat = skill.get('category', 'other')
            required_categories[cat] = required_categories.get(cat, 0) + 1
        
        fig = go.Figure(data=[go.Pie(
            labels=list(required_categories.keys()),
            values=list(required_categories.values()),
            hole=0.3
        )])
        
        fig.update_layout(
            title="Required Skills by Category",
            height=500
        )
        
        output_path = os.path.join(self.output_dir, "category_breakdown.html")
        fig.write_html(output_path)
        
        return output_path