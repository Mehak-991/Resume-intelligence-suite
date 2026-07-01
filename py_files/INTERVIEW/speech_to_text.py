"""
Speech-to-Text Module using Groq Whisper
"""

from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()


class SpeechToText:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=self.api_key)
        self.model = "whisper-large-v3"
    
    def transcribe(self, audio_file_path):
        """
        Transcribe audio file to text using Groq Whisper
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            str: Transcribed text
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    file=(audio_file_path, audio_file.read()),
                    model=self.model,
                    response_format="json",
                    language="en",
                    temperature=0.0
                )
            
            return transcription.text
            
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return None


if __name__ == "__main__":
    # Test the speech-to-text
    stt = SpeechToText()
    
    # Test with an audio file
    # text = stt.transcribe("test_recording.wav")
    # print(f"Transcribed: {text}")
