"""
LangGraph Workflow Definition
Orchestrates the three agents in sequence
"""

from langgraph.graph import StateGraph, END
from state import AgentState
from agent_skill_extractor import SkillExtractorAgent
from agent_gap_calculator import GapCalculatorAgent
from agent_course_recommender import CourseRecommenderAgent
from visualizer import SkillGapVisualizer


def create_skill_gap_workflow():
    """
    Create the LangGraph workflow with three agents
    """
    
    # Initialize agents
    skill_extractor = SkillExtractorAgent()
    gap_calculator = GapCalculatorAgent()
    course_recommender = CourseRecommenderAgent()
    visualizer = SkillGapVisualizer()
    
    # Define visualization node
    def create_visualizations(state: AgentState) -> AgentState:
        """Generate all visualizations"""
        print("\n📈 Creating visualizations...")
        
        try:
            paths = []
            
            # Radar chart
            radar_path = visualizer.create_radar_chart(
                state["candidate_skills"],
                state["required_skills"]
            )
            paths.append(radar_path)
            print(f"  ✓ Radar chart: {radar_path}")
            
            # Gap analysis chart
            gap_path = visualizer.create_gap_severity_chart(state["skill_gaps"])
            paths.append(gap_path)
            print(f"  ✓ Gap analysis: {gap_path}")
            
            # Learning roadmap
            if state.get("learning_roadmap"):
                roadmap_path = visualizer.create_learning_roadmap(
                    state["learning_roadmap"],
                    state["total_learning_time"]
                )
                paths.append(roadmap_path)
                print(f"  ✓ Learning roadmap: {roadmap_path}")
            
            # Category breakdown
            category_path = visualizer.create_category_breakdown(
                state["candidate_skills"],
                state["required_skills"]
            )
            paths.append(category_path)
            print(f"  ✓ Category breakdown: {category_path}")
            
            state["visualization_paths"] = paths
            state["workflow_status"] = "completed"
            
        except Exception as e:
            print(f"  ✗ Visualization error: {str(e)}")
            state["errors"] = state.get("errors", []) + [f"Visualization: {str(e)}"]
        
        return state
    
    # Create workflow graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("extract_skills", skill_extractor)
    workflow.add_node("calculate_gaps", gap_calculator)
    workflow.add_node("recommend_courses", course_recommender)
    workflow.add_node("create_visualizations", create_visualizations)
    
    # Define edges (sequential flow)
    workflow.set_entry_point("extract_skills")
    workflow.add_edge("extract_skills", "calculate_gaps")
    workflow.add_edge("calculate_gaps", "recommend_courses")
    workflow.add_edge("recommend_courses", "create_visualizations")
    workflow.add_edge("create_visualizations", END)
    
    # Compile workflow
    app = workflow.compile()
    
    return app


def print_summary(state: AgentState):
    """Print summary of the analysis"""
    
    print("\n" + "="*80)
    print("📊 SKILL GAP ANALYSIS SUMMARY")
    print("="*80)
    
    print(f"\n✅ Strong Skills ({len(state.get('strong_skills', []))}):")
    for skill in state.get('strong_skills', [])[:5]:
        print(f"   • {skill}")
    
    print(f"\n⚠️  Weak Skills ({len(state.get('weak_skills', []))}):")
    for skill in state.get('weak_skills', [])[:5]:
        print(f"   • {skill}")
    
    print(f"\n❌ Missing Skills ({len(state.get('missing_skills', []))}):")
    for skill in state.get('missing_skills', [])[:5]:
        print(f"   • {skill}")
    
    print(f"\n📚 Course Recommendations: {len(state.get('course_recommendations', []))}")
    print(f"⏱️  Total Learning Time: {state.get('total_learning_time', 0):.1f} hours")
    
    print(f"\n📈 Visualizations Generated:")
    for path in state.get('visualization_paths', []):
        print(f"   • {path}")
    
    if state.get('errors'):
        print(f"\n⚠️  Errors encountered:")
        for error in state['errors']:
            print(f"   • {error}")
    
    print("\n" + "="*80)