"""
Audio Recording Module
Handles voice input from the user
"""

import sounddevice as sd
import soundfile as sf
import numpy as np
import os
from datetime import datetime


class AudioRecorder:
    def __init__(self, sample_rate=16000, channels=1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.recording = []
        self.is_recording = False
    
    def record_audio(self, duration=None, output_file=None):
        """
        Record audio from microphone
        
        Args:
            duration: Recording duration in seconds (None for manual stop)
            output_file: Path to save the recording
            
        Returns:
            str: Path to the saved audio file
        """
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"recording_{timestamp}.wav"
        
        print("🎤 Recording... (Press Ctrl+C to stop if no duration specified)")
        
        try:
            if duration:
                # Record for specific duration
                audio_data = sd.rec(
                    int(duration * self.sample_rate),
                    samplerate=self.sample_rate,
                    channels=self.channels,
                    dtype='int16'
                )
                sd.wait()
            else:
                # Record until interrupted
                audio_data = sd.rec(
                    int(60 * self.sample_rate),  # Max 60 seconds
                    samplerate=self.sample_rate,
                    channels=self.channels,
                    dtype='int16'
                )
                sd.wait()
            
            # Save the recording
            sf.write(output_file, audio_data, self.sample_rate)
            print(f"✅ Recording saved to: {output_file}")
            
            return output_file
            
        except KeyboardInterrupt:
            print("\n⏹️ Recording stopped")
            if len(audio_data) > 0:
                sf.write(output_file, audio_data, self.sample_rate)
                return output_file
            return None
    
    def record_with_silence_detection(self, silence_threshold=0.01, silence_duration=2.0):
        """
        Record audio and automatically stop after silence is detected
        
        Args:
            silence_threshold: Amplitude threshold to detect silence
            silence_duration: Duration of silence in seconds to stop recording
            
        Returns:
            str: Path to the saved audio file
        """
        print("🎤 Recording... (Will stop after silence)")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"recording_{timestamp}.wav"
        
        chunk_size = int(0.1 * self.sample_rate)  # 100ms chunks
        silence_chunks = int(silence_duration / 0.1)
        
        recording = []
        silent_chunks_count = 0
        
        try:
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype='int16'
            ) as stream:
                while silent_chunks_count < silence_chunks:
                    chunk, _ = stream.read(chunk_size)
                    recording.append(chunk)
                    
                    # Check if chunk is silent
                    if np.abs(chunk).mean() < silence_threshold * 32768:
                        silent_chunks_count += 1
                    else:
                        silent_chunks_count = 0
            
            # Concatenate all chunks
            audio_data = np.concatenate(recording, axis=0)
            
            # Save the recording
            sf.write(output_file, audio_data, self.sample_rate)
            print(f"✅ Recording saved to: {output_file}")
            
            return output_file
            
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None


if __name__ == "__main__":
    # Test the audio recorder
    recorder = AudioRecorder()
    
    # Record for 5 seconds
    audio_file = recorder.record_audio(duration=5, output_file="test_recording.wav")
    print(f"Recorded: {audio_file}")
