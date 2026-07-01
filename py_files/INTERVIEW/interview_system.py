"""
AI Mock Interview System - Main Module
Complete integrated interview system
"""

import os
import time
from datetime import datetime
from dotenv import load_dotenv
from parser import ResumeJDParser
from audio_recorder import AudioRecorder
from speech_to_text import SpeechToText
from question_generator import QuestionGenerator
from interview_agent import InterviewAgent
from text_to_speech import TextToSpeech
from feedback_generator import FeedbackGenerator

load_dotenv()


class AIMockInterviewSystem:
    def __init__(self):
        print("Initializing AI Mock Interview System...")
        self.parser = ResumeJDParser()
        self.recorder = AudioRecorder()
        self.stt = SpeechToText()
        self.question_gen = QuestionGenerator()
        self.agent = InterviewAgent()
        self.tts = TextToSpeech()
        self.feedback_gen = FeedbackGenerator()
        self.interview_data = {
            'candidate_name': '',
            'position': '',
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'questions_and_answers': []
        }
        print("System initialized!\n")
    
    def setup_interview(self, resume_path, jd_path, candidate_name="", position=""):
        print("Parsing resume and job description...")
        try:
            self.resume_text, self.jd_text = self.parser.parse_resume_and_jd(resume_path, jd_path)
            print(f"Resume parsed: {len(self.resume_text)} characters")
            print(f"Job Description parsed: {len(self.jd_text)} characters")
            self.interview_data['candidate_name'] = candidate_name or "Candidate"
            self.interview_data['position'] = position or "Position"
            print("\nGenerating interview questions...")
            self.questions = self.question_gen.generate_questions(self.resume_text, self.jd_text)
            print(f"Generated {len(self.questions)} questions")
            return True
        except Exception as e:
            print(f"Setup error: {e}")
            return False
    
    def conduct_interview(self, max_answer_duration=60):
        """
        Conduct the full interview with voice interaction
        
        Args:
            max_answer_duration: Maximum duration for each answer in seconds
        """
        if not hasattr(self, 'questions'):
            print("❌ Please run setup_interview() first!")
            return
        
        print("\n" + "="*60)
        print("🎙️ STARTING AI MOCK INTERVIEW")
        print("="*60)
        
        # Introduction
        intro = f"Hello! Welcome to your mock interview for the {self.interview_data['position']} position. I'll be asking you {len(self.questions)} questions covering different difficulty levels. Please answer each question clearly. Let's begin!"
        self.tts.speak(intro)
        time.sleep(1)
        
        # Ask each question
        for i, q_data in enumerate(self.questions, 1):
            question = q_data['question']
            difficulty = q_data['difficulty']
            
            print(f"\n{'='*60}")
            print(f"Question {i}/{len(self.questions)} [{difficulty.upper()}]")
            print(f"{'='*60}")
            
            # Ask the question
            self.tts.speak(f"Question {i}. {question}")
            
            # Give candidate time to think
            print("\n⏳ You have a moment to think...")
            time.sleep(3)
            
            print("🎤 Please start speaking your answer...")
            time.sleep(1)
            
            # Record answer
            start_time = time.time()
            audio_file = self.recorder.record_audio(
                duration=max_answer_duration,
                output_file=f"answer_{i}.wav"
            )
            end_time = time.time()
            duration = end_time - start_time
            
            if not audio_file:
                print("⚠️ No audio recorded, skipping...")
                continue
            
            # Transcribe answer
            print("\n🔄 Transcribing your answer...")
            answer_text = self.stt.transcribe(audio_file)
            
            if not answer_text:
                print("⚠️ Could not transcribe answer, skipping...")
                continue
            
            print(f"\n📝 Your answer: {answer_text}")
            
            # Analyze answer
            print("\n🤔 Analyzing your response...")
            analysis = self.agent.analyze_answer(
                question=question,
                answer=answer_text,
                difficulty=difficulty,
                resume_context=self.resume_text,
                jd_context=self.jd_text
            )
            
            # Calculate speech metrics
            speech_metrics = self.agent.calculate_speech_metrics(answer_text, duration)
            
            # Store the Q&A
            self.interview_data['questions_and_answers'].append({
                'question_number': i,
                'question': question,
                'difficulty': difficulty,
                'answer': answer_text,
                'analysis': analysis,
                'speech_metrics': speech_metrics,
                'duration': duration
            })
            
            # Provide brief feedback
            print(f"\n💡 Quick feedback: {analysis.get('feedback', 'Good answer')}")
            print(f"📊 Score: {analysis.get('overall_score', 0)}/100")
            
            # Clean up audio file
            try:
                os.remove(audio_file)
            except:
                pass
            
            # Brief pause before next question
            if i < len(self.questions):
                time.sleep(2)
        
        print("\n" + "="*60)
        print("✅ INTERVIEW COMPLETED!")
        print("="*60)
        
        # Generate final report
        print("\n📊 Generating your comprehensive feedback report...\n")
        self.final_report = self.feedback_gen.generate_final_report(self.interview_data)
        
        return self.final_report
    
    def get_report(self):
        """Get the final interview report"""
        if hasattr(self, 'final_report'):
            return self.final_report
        else:
            print("⚠️ No interview conducted yet!")
            return None
    
    def print_report(self):
        """Print the final report to console"""
        if hasattr(self, 'final_report'):
            self.feedback_gen.print_report(self.final_report)
        else:
            print("⚠️ No interview conducted yet!")
    
    def save_report(self, filename='interview_report.json'):
        """Save the final report to file"""
        if hasattr(self, 'final_report'):
            self.feedback_gen.save_report(self.final_report, filename)
        else:
            print("⚠️ No interview conducted yet!")


def main():
    """
    Main function to run the complete interview system
    """
    print("\n" + "#"*60)
    print("#" + " "*58 + "#")
    print("#" + "  AI MOCK INTERVIEW SYSTEM".center(58) + "#")
    print("#" + "  Powered by Groq AI".center(58) + "#")
    print("#" + " "*58 + "#")
    print("#"*60 + "\n")
    
    # Initialize the system
    system = AIMockInterviewSystem()
    
    # Get resume and JD paths
    print("📄 Please provide the following information:\n")
    
    resume_path = input("Enter path to resume (PDF/DOCX/TXT): ").strip()
    jd_path = input("Enter path to job description (PDF/DOCX/TXT): ").strip()
    candidate_name = input("Enter candidate name (optional): ").strip()
    position = input("Enter position/role (optional): ").strip()
    
    print("\n" + "-"*60)
    
    # Setup the interview
    if not system.setup_interview(resume_path, jd_path, candidate_name, position):
        print("\n❌ Failed to setup interview. Please check your files and try again.")
        return
    
    print("\n" + "-"*60)
    print("\n✅ Interview setup complete!")
    
    # Preview questions
    print("\n📋 Interview will include:")
    print(f"   - {sum(1 for q in system.questions if q['difficulty'] == 'easy')} Easy questions")
    print(f"   - {sum(1 for q in system.questions if q['difficulty'] == 'medium')} Medium questions")
    print(f"   - {sum(1 for q in system.questions if q['difficulty'] == 'hard')} Hard questions")
    
    input("\n✨ Press ENTER to start the interview...")
    
    # Conduct the interview
    report = system.conduct_interview(max_answer_duration=60)
    
    if report:
        # Print the comprehensive report
        system.print_report()
        
        # Save the report
        report_filename = f"interview_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        system.save_report(report_filename)
        
        print("\n" + "="*60)
        print("🎉 Thank you for completing the mock interview!")
        print("📊 Your detailed report has been saved.")
        print("💡 Review the feedback and practice recommendations.")
        print("="*60 + "\n")
    else:
        print("\n❌ Interview was not completed successfully.")


if __name__ == "__main__":
    main()
