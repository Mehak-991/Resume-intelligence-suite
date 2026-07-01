"""
Text-to-Speech Module using pyttsx3
"""

import pyttsx3
import platform


class TextToSpeech:
    def __init__(self, rate=150, volume=0.9):
        """
        Initialize TTS engine
        
        Args:
            rate: Speech rate (words per minute)
            volume: Volume level (0.0 to 1.0)
        """
        self.engine = pyttsx3.init()
        
        # Set properties
        self.engine.setProperty('rate', rate)
        self.engine.setProperty('volume', volume)
        
        # Get available voices
        voices = self.engine.getProperty('voices')
        
        # Try to set a pleasant voice (prefer female voices for interviews)
        if len(voices) > 0:
            # On Windows, try to find Microsoft Zira (female voice)
            if platform.system() == 'Windows':
                for voice in voices:
                    if 'zira' in voice.name.lower():
                        self.engine.setProperty('voice', voice.id)
                        break
                else:
                    # Fallback to first available voice
                    self.engine.setProperty('voice', voices[0].id)
            else:
                # On Mac/Linux, use first voice
                self.engine.setProperty('voice', voices[0].id)
    
    def speak(self, text):
        """
        Convert text to speech and play it
        
        Args:
            text: Text to speak
        """
        print(f"\n🔊 Interviewer: {text}")
        self.engine.say(text)
        self.engine.runAndWait()
    
    def save_to_file(self, text, filename):
        """
        Save speech to audio file
        
        Args:
            text: Text to convert
            filename: Output audio file path
        """
        self.engine.save_to_file(text, filename)
        self.engine.runAndWait()
    
    def set_rate(self, rate):
        """Change speech rate"""
        self.engine.setProperty('rate', rate)
    
    def set_volume(self, volume):
        """Change volume (0.0 to 1.0)"""
        self.engine.setProperty('volume', volume)
    
    def list_voices(self):
        """List all available voices"""
        voices = self.engine.getProperty('voices')
        print("\nAvailable voices:")
        for i, voice in enumerate(voices):
            print(f"{i}. {voice.name} ({voice.id})")
        return voices
    
    def set_voice_by_index(self, index):
        """Set voice by index"""
        voices = self.engine.getProperty('voices')
        if 0 <= index < len(voices):
            self.engine.setProperty('voice', voices[index].id)
            print(f"Voice set to: {voices[index].name}")
        else:
            print(f"Invalid voice index. Available: 0-{len(voices)-1}")


if __name__ == "__main__":
    # Test the TTS
    tts = TextToSpeech()
    
    # List available voices
    tts.list_voices()
    
    # Speak a test message
    tts.speak("Hello! I'm your AI interviewer. Let's begin the interview.")
