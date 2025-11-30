import { Audio } from 'expo-av';
import { ensureSignedIn } from '../firebaseClient';
import { File } from 'expo-file-system';

const GCF_TEXT_URL = "https://beright-app-1021561698058.europe-west1.run.app";

export interface ExtractedConversation {
  topic: string;
  viewpointA: string;
  viewpointB: string;
  transcript: string;
  confidence: 'high' | 'medium' | 'low';
}

export class ConversationListener {
  private recording: Audio.Recording | null = null;
  private startTime: number = 0;

  async startListening(): Promise<void> {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Audio permission not granted');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.MEDIUM_QUALITY
    );
    
    this.recording = recording;
    this.startTime = Date.now();
  }

  async stopAndTranscribe(): Promise<ExtractedConversation> {
    if (!this.recording) {
      throw new Error('No active recording');
    }

    // Stop recording
    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;

    if (!uri) {
      throw new Error('No recording URI');
    }

    // Read audio as base64 using new SDK 54 API
    const file = new File(uri);
    const audioBase64 = await file.base64();

    // Send to Cloud Function for transcription + extraction
    const idToken = await ensureSignedIn();
    const response = await fetch(GCF_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action: 'transcribeAndExtract',
        payload: {
          audioData: audioBase64,
          mimeType: 'audio/m4a',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  getRecordingDuration(): number {
    return this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
  }

  isRecording(): boolean {
    return this.recording !== null;
  }
}

