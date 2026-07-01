"""
Interview Agent Module
Analyzes answers and provides feedback
"""

from groq import Groq
import os
from dotenv import load_dotenv
import json
import re

load_dotenv()


class InterviewAgent:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=self.api_key)
        self.model = "llama-3.3-70b-versatile"
    
    def analyze_answer(self, question, answer, difficulty, resume_context="", jd_context=""):
        """
        Analyze candidate's answer and generate feedback
        
        Args:
            question: The interview question asked
            answer: Candidate's answer
            difficulty: Question difficulty (easy/medium/hard)
            resume_context: Resume text for context
            jd_context: Job description for context
            
        Returns:
            dict: Analysis with scores and feedback
        """
        prompt = f"""You are an expert interviewer analyzing a candidate's response.

QUESTION [{difficulty.upper()}]: {question}

CANDIDATE'S ANSWER: {answer}

Analyze this answer based on:
1. CONTENT RELEVANCE (0-100): How well does the answer address the question?
2. CLARITY (0-100): How clear and well-structured is the communication?
3. COMPLETENESS (0-100): Does the answer cover all aspects of the question?
4. STAR METHOD (0-100): For behavioral questions, does it follow Situation-Task-Action-Result?
5. TECHNICAL DEPTH (0-100): For technical questions, how deep is the understanding?

Also analyze:
- Key strengths in the answer
- Areas for improvement
- Whether the answer is too brief or too verbose

Return ONLY a JSON object with this format:
{{
  "content_relevance": 85,
  "clarity": 90,
  "completeness": 75,
  "star_method": 80,
  "technical_depth": 70,
  "overall_score": 80,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "feedback": "Brief overall feedback"
}}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert interviewer providing constructive feedback. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            analysis = json.loads(content)
            
            return analysis
            
        except Exception as e:
            print(f"❌ Answer analysis error: {e}")
            return self._get_fallback_analysis()
    
    def _get_fallback_analysis(self):
        """Fallback analysis if LLM fails"""
        return {
            "content_relevance": 70,
            "clarity": 70,
            "completeness": 70,
            "star_method": 60,
            "technical_depth": 65,
            "overall_score": 67,
            "strengths": ["Answer provided"],
            "improvements": ["Could provide more detail"],
            "feedback": "Good attempt. Consider elaborating more on your points."
        }
    
    def calculate_speech_metrics(self, answer_text, duration_seconds):
        """
        Calculate speech-related metrics
        
        Args:
            answer_text: Transcribed answer text
            duration_seconds: Duration of the speech
            
        Returns:
            dict: Speech metrics including pace, word count
        """
        words = answer_text.split()
        word_count = len(words)
        
        if duration_seconds > 0:
            words_per_minute = (word_count / duration_seconds) * 60
        else:
            words_per_minute = 0
        
        # Ideal pace is 130-170 words per minute
        if 130 <= words_per_minute <= 170:
            pace_score = 100
            pace_feedback = "Excellent pace"
        elif 110 <= words_per_minute < 130 or 170 < words_per_minute <= 190:
            pace_score = 80
            pace_feedback = "Good pace, could be slightly adjusted"
        elif 90 <= words_per_minute < 110 or 190 < words_per_minute <= 210:
            pace_score = 60
            pace_feedback = "Pace is a bit slow" if words_per_minute < 130 else "Pace is a bit fast"
        else:
            pace_score = 40
            pace_feedback = "Pace needs improvement - too slow" if words_per_minute < 90 else "Pace needs improvement - too fast"
        
        return {
            "word_count": word_count,
            "duration_seconds": duration_seconds,
            "words_per_minute": round(words_per_minute, 1),
            "pace_score": pace_score,
            "pace_feedback": pace_feedback
        }
    
    def generate_follow_up_question(self, original_question, answer, interview_context=""):
        """
        Generate a follow-up question based on the answer
        
        Args:
            original_question: The original question asked
            answer: Candidate's answer
            interview_context: Previous conversation context
            
        Returns:
            str: Follow-up question
        """
        prompt = f"""Based on this interview exchange, generate ONE relevant follow-up question.

ORIGINAL QUESTION: {original_question}
CANDIDATE'S ANSWER: {answer}

Generate a natural follow-up question that:
- Digs deeper into what the candidate mentioned
- Clarifies any vague points
- Explores their thought process
- Is conversational and encouraging

Return ONLY the follow-up question, nothing else."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an interviewer asking insightful follow-up questions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=150
            )
            
            follow_up = response.choices[0].message.content.strip()
            return follow_up
            
        except Exception as e:
            print(f"❌ Follow-up generation error: {e}")
            return "Could you elaborate more on that point?"


if __name__ == "__main__":
    # Test the interview agent
    agent = InterviewAgent()
    
    question = "Tell me about a challenging project you worked on."
    answer = "I worked on a web application that had performance issues. I identified the bottleneck and optimized the database queries, which improved response time by 50%."
    
    analysis = agent.analyze_answer(question, answer, "medium")
    print("Analysis:", json.dumps(analysis, indent=2))
    
    metrics = agent.calculate_speech_metrics(answer, 15)
    print("\nSpeech Metrics:", json.dumps(metrics, indent=2))
