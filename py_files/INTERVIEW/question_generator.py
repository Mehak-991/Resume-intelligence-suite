"""
Question Generator Module
Generates interview questions based on resume and JD
"""

from groq import Groq
import os
from dotenv import load_dotenv
import json

load_dotenv()


class QuestionGenerator:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=self.api_key)
        self.model = "llama-3.3-70b-versatile"
    
    def generate_questions(self, resume_text, jd_text):
        """
        Generate 10 interview questions (4 easy, 4 medium, 2 hard)
        
        Args:
            resume_text: Resume content
            jd_text: Job description content
            
        Returns:
            list: List of question dictionaries with difficulty levels
        """
        prompt = f"""You are an expert technical interviewer. Based on the candidate's resume and the job description, generate EXACTLY 10 interview questions.

RESUME:
{resume_text[:1500]}

JOB DESCRIPTION:
{jd_text[:1500]}

Generate questions with the following distribution:
- 4 EASY questions (basic concepts, general experience)
- 4 MEDIUM questions (practical scenarios, problem-solving)
- 2 HARD questions (complex scenarios, deep technical knowledge)

Return ONLY a JSON array with this exact format:
[
  {{"difficulty": "easy", "question": "question text here"}},
  {{"difficulty": "easy", "question": "question text here"}},
  {{"difficulty": "easy", "question": "question text here"}},
  {{"difficulty": "easy", "question": "question text here"}},
  {{"difficulty": "medium", "question": "question text here"}},
  {{"difficulty": "medium", "question": "question text here"}},
  {{"difficulty": "medium", "question": "question text here"}},
  {{"difficulty": "medium", "question": "question text here"}},
  {{"difficulty": "hard", "question": "question text here"}},
  {{"difficulty": "hard", "question": "question text here"}}
]

Make questions relevant to both the candidate's background and the job requirements.
Do not include any explanation, just the JSON array."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert interviewer. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            questions = json.loads(content)
            
            # Validate we have exactly 10 questions
            if len(questions) != 10:
                print(f"⚠️ Expected 10 questions, got {len(questions)}, using fallback")
                return self._get_fallback_questions()
            
            # Validate structure
            for q in questions:
                if 'difficulty' not in q or 'question' not in q:
                    print(f"⚠️ Invalid question structure, using fallback")
                    return self._get_fallback_questions()
            
            print("✅ Successfully generated 10 interview questions")
            return questions
            
        except Exception as e:
            print(f"❌ Question generation error: {e}")
            print("📝 Using fallback questions")
            return self._get_fallback_questions()
    
    def _get_fallback_questions(self):
        """Fallback questions if generation fails"""
        return [
            {"difficulty": "easy", "question": "Tell me about yourself and your background."},
            {"difficulty": "easy", "question": "What interests you about this role?"},
            {"difficulty": "easy", "question": "What are your key strengths?"},
            {"difficulty": "easy", "question": "Describe your typical work day."},
            {"difficulty": "medium", "question": "Tell me about a challenging project you worked on."},
            {"difficulty": "medium", "question": "How do you handle tight deadlines?"},
            {"difficulty": "medium", "question": "Describe a time you worked in a team."},
            {"difficulty": "medium", "question": "How do you stay updated with industry trends?"},
            {"difficulty": "hard", "question": "Describe a complex technical problem you solved."},
            {"difficulty": "hard", "question": "How would you handle a situation where you disagree with your manager?"}
        ]


if __name__ == "__main__":
    # Test the question generator
    print("Testing Question Generator...")
    generator = QuestionGenerator()
    
    sample_resume = "Software Engineer with 3 years of Python experience in web development..."
    sample_jd = "Looking for a Senior Python Developer with Django expertise and cloud experience..."
    
    print("\nGenerating questions...")
    questions = generator.generate_questions(sample_resume, sample_jd)
    
    print(f"\n✅ Generated {len(questions)} questions:\n")
    for i, q in enumerate(questions, 1):
        print(f"{i}. [{q['difficulty'].upper()}] {q['question']}")
