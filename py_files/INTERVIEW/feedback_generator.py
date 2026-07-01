"""
Feedback Generator Module
Generates comprehensive interview feedback and report
"""

import json
from datetime import datetime


class FeedbackGenerator:
    def __init__(self):
        self.weights = {
            'content_relevance': 0.30,
            'clarity': 0.20,
            'completeness': 0.20,
            'star_method': 0.15,
            'technical_depth': 0.10,
            'pace': 0.05
        }
    
    def generate_final_report(self, interview_data):
        """
        Generate comprehensive interview feedback report
        
        Args:
            interview_data: Dictionary containing all interview information
                {
                    'candidate_name': str,
                    'position': str,
                    'date': str,
                    'questions_and_answers': [
                        {
                            'question': str,
                            'difficulty': str,
                            'answer': str,
                            'analysis': dict,
                            'speech_metrics': dict
                        }
                    ]
                }
        
        Returns:
            dict: Comprehensive feedback report
        """
        qa_pairs = interview_data.get('questions_and_answers', [])
        
        if not qa_pairs:
            return self._empty_report()
        
        # Calculate aggregate scores
        total_content = sum(qa['analysis'].get('content_relevance', 0) for qa in qa_pairs) / len(qa_pairs)
        total_clarity = sum(qa['analysis'].get('clarity', 0) for qa in qa_pairs) / len(qa_pairs)
        total_completeness = sum(qa['analysis'].get('completeness', 0) for qa in qa_pairs) / len(qa_pairs)
        total_star = sum(qa['analysis'].get('star_method', 0) for qa in qa_pairs) / len(qa_pairs)
        total_technical = sum(qa['analysis'].get('technical_depth', 0) for qa in qa_pairs) / len(qa_pairs)
        total_pace = sum(qa['speech_metrics'].get('pace_score', 70) for qa in qa_pairs if 'speech_metrics' in qa) / len(qa_pairs)
        
        # Calculate weighted overall score
        overall_score = (
            total_content * self.weights['content_relevance'] +
            total_clarity * self.weights['clarity'] +
            total_completeness * self.weights['completeness'] +
            total_star * self.weights['star_method'] +
            total_technical * self.weights['technical_depth'] +
            total_pace * self.weights['pace']
        )
        
        # Performance by difficulty
        performance_by_difficulty = self._calculate_performance_by_difficulty(qa_pairs)
        
        # Identify strengths and areas for improvement
        strengths = self._identify_strengths(qa_pairs, {
            'content_relevance': total_content,
            'clarity': total_clarity,
            'completeness': total_completeness,
            'star_method': total_star,
            'technical_depth': total_technical,
            'pace': total_pace
        })
        
        improvements = self._identify_improvements(qa_pairs, {
            'content_relevance': total_content,
            'clarity': total_clarity,
            'completeness': total_completeness,
            'star_method': total_star,
            'technical_depth': total_technical,
            'pace': total_pace
        })
        
        # Generate practice recommendations
        practice_areas = self._generate_practice_recommendations(improvements, performance_by_difficulty)
        
        # Create the report
        report = {
            'candidate_info': {
                'name': interview_data.get('candidate_name', 'N/A'),
                'position': interview_data.get('position', 'N/A'),
                'date': interview_data.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            },
            'overall_score': round(overall_score, 1),
            'performance_grade': self._get_grade(overall_score),
            'detailed_scores': {
                'content_relevance': round(total_content, 1),
                'clarity': round(total_clarity, 1),
                'completeness': round(total_completeness, 1),
                'star_method_compliance': round(total_star, 1),
                'technical_depth': round(total_technical, 1),
                'pace': round(total_pace, 1)
            },
            'performance_by_difficulty': performance_by_difficulty,
            'strengths': strengths,
            'areas_for_improvement': improvements,
            'practice_recommendations': practice_areas,
            'question_breakdown': self._format_question_breakdown(qa_pairs)
        }
        
        return report
    
    def _calculate_performance_by_difficulty(self, qa_pairs):
        """Calculate average performance by difficulty level"""
        difficulty_scores = {'easy': [], 'medium': [], 'hard': []}
        
        for qa in qa_pairs:
            difficulty = qa.get('difficulty', 'medium')
            score = qa['analysis'].get('overall_score', 0)
            if difficulty in difficulty_scores:
                difficulty_scores[difficulty].append(score)
        
        return {
            diff: round(sum(scores) / len(scores), 1) if scores else 0
            for diff, scores in difficulty_scores.items()
        }
    
    def _identify_strengths(self, qa_pairs, avg_scores):
        """Identify candidate's key strengths"""
        strengths = []
        
        if avg_scores['content_relevance'] >= 80:
            strengths.append("Strong ability to address questions directly and relevantly")
        
        if avg_scores['clarity'] >= 80:
            strengths.append("Excellent communication clarity and structure")
        
        if avg_scores['completeness'] >= 80:
            strengths.append("Comprehensive answers covering all aspects")
        
        if avg_scores['star_method'] >= 75:
            strengths.append("Good use of STAR method in behavioral responses")
        
        if avg_scores['technical_depth'] >= 75:
            strengths.append("Solid technical knowledge and depth")
        
        if avg_scores['pace'] >= 80:
            strengths.append("Well-paced delivery")
        
        # Collect specific strengths from individual questions
        specific_strengths = []
        for qa in qa_pairs:
            qa_strengths = qa['analysis'].get('strengths', [])
            specific_strengths.extend(qa_strengths)
        
        # Add unique specific strengths
        unique_specifics = list(set(specific_strengths))[:3]
        strengths.extend(unique_specifics)
        
        return strengths[:5] if strengths else ["Participated in the interview"]
    
    def _identify_improvements(self, qa_pairs, avg_scores):
        """Identify areas for improvement"""
        improvements = []
        
        if avg_scores['content_relevance'] < 70:
            improvements.append("Focus on directly addressing the question asked")
        
        if avg_scores['clarity'] < 70:
            improvements.append("Work on structuring answers more clearly")
        
        if avg_scores['completeness'] < 70:
            improvements.append("Provide more comprehensive answers")
        
        if avg_scores['star_method'] < 60:
            improvements.append("Practice using the STAR method for behavioral questions")
        
        if avg_scores['technical_depth'] < 65:
            improvements.append("Deepen technical knowledge in key areas")
        
        if avg_scores['pace'] < 60:
            improvements.append("Adjust speaking pace - aim for 130-170 words per minute")
        
        # Collect specific improvements from individual questions
        specific_improvements = []
        for qa in qa_pairs:
            qa_improvements = qa['analysis'].get('improvements', [])
            specific_improvements.extend(qa_improvements)
        
        # Add unique specific improvements
        unique_specifics = list(set(specific_improvements))[:3]
        improvements.extend(unique_specifics)
        
        return improvements[:5] if improvements else ["Continue practicing"]
    
    def _generate_practice_recommendations(self, improvements, performance_by_difficulty):
        """Generate specific practice recommendations"""
        recommendations = []
        
        # Based on difficulty performance
        if performance_by_difficulty.get('easy', 0) < 70:
            recommendations.append("Practice fundamental concepts and common interview questions")
        
        if performance_by_difficulty.get('medium', 0) < 65:
            recommendations.append("Focus on scenario-based questions and problem-solving")
        
        if performance_by_difficulty.get('hard', 0) < 60:
            recommendations.append("Study advanced topics and complex technical scenarios")
        
        # Based on improvements needed
        if any('STAR' in imp for imp in improvements):
            recommendations.append("Practice behavioral questions using STAR method (Situation, Task, Action, Result)")
        
        if any('technical' in imp.lower() for imp in improvements):
            recommendations.append("Review technical concepts and work on hands-on projects")
        
        if any('pace' in imp.lower() for imp in improvements):
            recommendations.append("Practice speaking clearly at a moderate pace")
        
        return recommendations[:4] if recommendations else ["Keep practicing interview skills"]
    
    def _format_question_breakdown(self, qa_pairs):
        """Format individual question feedback"""
        breakdown = []
        
        for i, qa in enumerate(qa_pairs, 1):
            breakdown.append({
                'question_number': i,
                'difficulty': qa.get('difficulty', 'medium'),
                'question': qa.get('question', ''),
                'answer_length': len(qa.get('answer', '').split()),
                'scores': {
                    'content_relevance': qa['analysis'].get('content_relevance', 0),
                    'clarity': qa['analysis'].get('clarity', 0),
                    'overall': qa['analysis'].get('overall_score', 0)
                },
                'feedback': qa['analysis'].get('feedback', '')
            })
        
        return breakdown
    
    def _get_grade(self, score):
        """Convert numerical score to letter grade"""
        if score >= 90:
            return 'A (Excellent)'
        elif score >= 80:
            return 'B (Good)'
        elif score >= 70:
            return 'C (Average)'
        elif score >= 60:
            return 'D (Below Average)'
        else:
            return 'F (Needs Improvement)'
    
    def _empty_report(self):
        """Return empty report structure"""
        return {
            'overall_score': 0,
            'performance_grade': 'N/A',
            'message': 'No interview data available'
        }
    
    def save_report(self, report, filename='interview_report.json'):
        """Save report to JSON file"""
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"✅ Report saved to {filename}")
    
    def print_report(self, report):
        """Print formatted report to console"""
        print("\n" + "="*60)
        print("📊 INTERVIEW PERFORMANCE REPORT")
        print("="*60)
        
        # Candidate info
        info = report.get('candidate_info', {})
        print(f"\nCandidate: {info.get('name', 'N/A')}")
        print(f"Position: {info.get('position', 'N/A')}")
        print(f"Date: {info.get('date', 'N/A')}")
        
        # Overall score
        print(f"\n{'OVERALL SCORE:':<30} {report.get('overall_score', 0)}/100")
        print(f"{'GRADE:':<30} {report.get('performance_grade', 'N/A')}")
        
        # Detailed scores
        print("\n" + "-"*60)
        print("DETAILED SCORES:")
        print("-"*60)
        scores = report.get('detailed_scores', {})
        for metric, score in scores.items():
            print(f"{metric.replace('_', ' ').title():<30} {score}/100")
        
        # Performance by difficulty
        print("\n" + "-"*60)
        print("PERFORMANCE BY DIFFICULTY:")
        print("-"*60)
        perf = report.get('performance_by_difficulty', {})
        for diff, score in perf.items():
            print(f"{diff.capitalize():<30} {score}/100")
        
        # Strengths
        print("\n" + "-"*60)
        print("✅ STRENGTHS:")
        print("-"*60)
        for i, strength in enumerate(report.get('strengths', []), 1):
            print(f"{i}. {strength}")
        
        # Improvements
        print("\n" + "-"*60)
        print("📈 AREAS FOR IMPROVEMENT:")
        print("-"*60)
        for i, improvement in enumerate(report.get('areas_for_improvement', []), 1):
            print(f"{i}. {improvement}")
        
        # Practice recommendations
        print("\n" + "-"*60)
        print("💡 PRACTICE RECOMMENDATIONS:")
        print("-"*60)
        for i, rec in enumerate(report.get('practice_recommendations', []), 1):
            print(f"{i}. {rec}")
        
        print("\n" + "="*60)


if __name__ == "__main__":
    # Test the feedback generator
    generator = FeedbackGenerator()
    
    # Sample data
    sample_data = {
        'candidate_name': 'John Doe',
        'position': 'Software Engineer',
        'date': '2024-02-07',
        'questions_and_answers': [
            {
                'question': 'Tell me about yourself',
                'difficulty': 'easy',
                'answer': 'I am a software engineer...',
                'analysis': {
                    'content_relevance': 85,
                    'clarity': 90,
                    'completeness': 80,
                    'star_method': 75,
                    'technical_depth': 70,
                    'overall_score': 80,
                    'strengths': ['Clear communication'],
                    'improvements': ['Add more detail'],
                    'feedback': 'Good answer'
                },
                'speech_metrics': {
                    'pace_score': 85
                }
            }
        ]
    }
    
    report = generator.generate_final_report(sample_data)
    generator.print_report(report)
