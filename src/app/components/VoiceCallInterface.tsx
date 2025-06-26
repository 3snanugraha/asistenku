"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppConfig, getBestVoiceForLanguage } from "@/utils/config";
import { getAPIClient, ChatMessage } from "@/utils/api";
import { formatForVoice, isVoiceSuitable } from "@/utils/voiceformatter";

interface VoiceCallInterfaceProps {
  config: AppConfig;
  onEndCall: () => void;
}

type CallStatus =
  | "connecting"
  | "connected"
  | "speaking"
  | "listening"
  | "thinking"
  | "error"
  | "ended";

// Proper Speech Recognition Types
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
  readonly length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: unknown;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
  onnomatch:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

export default function VoiceCallInterface({
  config,
  onEndCall,
}: VoiceCallInterfaceProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("connecting");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(
    []
  );
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [lastAIResponse, setLastAIResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const callStartTimeRef = useRef<number>(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Use refs to avoid circular dependencies
  const handleUserSpeechRef = useRef<
    ((transcript: string) => Promise<void>) | null
  >(null);
  const speakAIMessageRef = useRef<((message: string) => Promise<void>) | null>(
    null
  );
  const monitorAudioLevelRef = useRef<(() => void) | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop speech synthesis
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    // Stop audio monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Clear timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  }, []);

  // Monitor audio level function
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }, []);

  // Update ref
  useEffect(() => {
    monitorAudioLevelRef.current = monitorAudioLevel;
  }, [monitorAudioLevel]);

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start audio level monitoring
      if (monitorAudioLevelRef.current) {
        monitorAudioLevelRef.current();
      }
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
    }
  }, []);

  // Speak AI message function
  const speakAIMessage = useCallback(
    async (message: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!("speechSynthesis" in window)) {
          reject(new Error("Speech synthesis tidak didukung"));
          return;
        }

        // Format message for voice synthesis
        const formattedMessage = formatForVoice(message);

        // Check if formatted message is suitable for voice
        if (!isVoiceSuitable(formattedMessage)) {
          console.warn("Message not suitable for voice synthesis:", message);
          // Fallback to simple response
          const fallbackMessage =
            "Maaf, saya tidak dapat memproses respons tersebut dengan baik.";
          const finalMessage = formatForVoice(fallbackMessage);

          if (!finalMessage.trim()) {
            reject(new Error("Tidak ada konten yang dapat diucapkan"));
            return;
          }
        }

        const textToSpeak =
          formattedMessage.trim() ||
          "Maaf, tidak ada respons yang dapat saya berikan.";

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        // Configure voice
        const voice = getBestVoiceForLanguage(config.voice.language);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.rate = config.voice.rate;
        utterance.pitch = config.voice.pitch;
        utterance.volume = config.voice.volume;
        utterance.lang = config.voice.language;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setCallStatus("speaking");
          // Store original message for display, not the formatted one
          setLastAIResponse(message);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setCallStatus("connected");

          // Restart recognition after speaking
          setCallStatus((currentStatus) => {
            if (
              recognitionRef.current &&
              !isMuted &&
              (currentStatus === "connected" || currentStatus === "speaking")
            ) {
              setTimeout(() => {
                try {
                  recognitionRef.current?.start();
                } catch (error) {
                  console.error("Failed to resume listening:", error);
                }
              }, 500);
            }
            return "connected";
          });
          resolve();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          setCallStatus("error");
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        synthesisRef.current = utterance;
        speechSynthesis.speak(utterance);
      });
    },
    [config.voice, isMuted]
  );

  // Update ref
  useEffect(() => {
    speakAIMessageRef.current = speakAIMessage;
  }, [speakAIMessage]);

  // Handle user speech function
  const handleUserSpeech = useCallback(
    async (transcript: string) => {
      if (!transcript || transcript.length < 2) return;

      // Add user message to history
      const userMessage: ChatMessage = {
        role: "user",
        content: transcript,
        timestamp: new Date(),
      };

      setConversationHistory((prev) => [...prev, userMessage]);
      setCallStatus("thinking");

      try {
        // Send to AI
        const apiClient = getAPIClient(config.ai);
        const response = await apiClient.sendMessage(
          transcript,
          conversationHistory
        );

        if (response.success && response.message) {
          // Add AI response to history (store original response)
          const aiMessage: ChatMessage = {
            role: "assistant",
            content: response.message,
            timestamp: new Date(),
          };

          setConversationHistory((prev) => [...prev, aiMessage]);

          // Check if response is suitable for voice
          if (!isVoiceSuitable(response.message)) {
            console.warn(
              "AI response not suitable for voice:",
              response.message
            );
            // Create a fallback response
            const fallbackResponse =
              "Saya telah memproses permintaan Anda. Apakah ada yang bisa saya bantu lagi?";
            if (speakAIMessageRef.current) {
              await speakAIMessageRef.current(fallbackResponse);
            }
          } else {
            // Speak AI response (will be formatted inside speakAIMessage)
            if (speakAIMessageRef.current) {
              await speakAIMessageRef.current(response.message);
            }
          }
        } else {
          throw new Error(response.error || "AI tidak merespons");
        }
      } catch (error) {
        console.error("Error getting AI response:", error);
        const errorMsg =
          "Maaf, terjadi kesalahan saat berkomunikasi dengan AI. Silakan coba lagi.";
        setErrorMessage(errorMsg);

        // Speak error message
        if (speakAIMessageRef.current) {
          try {
            await speakAIMessageRef.current(errorMsg);
          } catch (voiceError) {
            console.error("Failed to speak error message:", voiceError);
            setCallStatus("error");
          }
        } else {
          setCallStatus("error");
        }
      }
    },
    [config.ai, conversationHistory]
  );

  // Update ref
  useEffect(() => {
    handleUserSpeechRef.current = handleUserSpeech;
  }, [handleUserSpeech]);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(async () => {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = config.speechRecognition.continuous;
    recognition.interimResults = config.speechRecognition.interimResults;
    recognition.lang = config.speechRecognition.language;
    recognition.maxAlternatives = config.speechRecognition.maxAlternatives;

    recognition.onstart = () => {
      setIsRecording(true);
      setCallStatus("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setCurrentTranscript(interimTranscript);

      if (finalTranscript && handleUserSpeechRef.current) {
        handleUserSpeechRef.current(finalTranscript.trim());
        setCurrentTranscript("");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setErrorMessage(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Restart recognition if call is still active
      setCallStatus((currentStatus) => {
        if (
          recognitionRef.current &&
          !isMuted &&
          (currentStatus === "connected" || currentStatus === "listening") // Fix: Only check valid statuses
        ) {
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (error) {
              console.error("Failed to restart recognition:", error);
            }
          }, 100);
        }
        return currentStatus;
      });
    };

    recognitionRef.current = recognition;
  }, [config.speechRecognition, isMuted]);

  // Initialize call function
  const initializeCall = useCallback(async () => {
    try {
      // Check if speech recognition is supported
      if (
        !("webkitSpeechRecognition" in window) &&
        !("SpeechRecognition" in window)
      ) {
        throw new Error("Speech recognition tidak didukung di browser ini");
      }

      // Check if speech synthesis is supported
      if (!("speechSynthesis" in window)) {
        throw new Error("Speech synthesis tidak didukung di browser ini");
      }

      // Test API connection
      const apiClient = getAPIClient(config.ai);
      const isConnected = await apiClient.checkConnection();
      if (!isConnected) {
        throw new Error("Tidak dapat terhubung ke Ollama AI");
      }

      // Initialize speech recognition
      await initializeSpeechRecognition();

      // Initialize audio context for voice level detection
      await initializeAudioContext();

      setCallStatus("connected");

      // Start with AI greeting
      setTimeout(() => {
        if (speakAIMessageRef.current) {
          speakAIMessageRef.current(
            `Halo ${config.userName}! Saya ${config.aiName}. Bagaimana kabar Anda hari ini?`
          );
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to initialize call:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memulai panggilan"
      );
      setCallStatus("error");
    }
  }, [config, initializeAudioContext, initializeSpeechRecognition]);

  // Initialize call effect
  useEffect(() => {
    initializeCall();
    return cleanup;
  }, [initializeCall, cleanup]);

  // Call duration timer
  useEffect(() => {
    if (
      callStatus === "connected" ||
      callStatus === "speaking" ||
      callStatus === "listening" ||
      callStatus === "thinking"
    ) {
      const interval = setInterval(() => {
        setCallDuration(
          Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        );
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // Toggle mute function
  const toggleMute = useCallback(() => {
    if (isMuted) {
      // Unmute - start listening
      setIsMuted(false);
      if (recognitionRef.current && !isSpeaking) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error("Failed to start recognition:", error);
        }
      }
    } else {
      // Mute - stop listening
      setIsMuted(true);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  }, [isMuted, isSpeaking]);

  // End call function
  const endCall = useCallback(() => {
    setCallStatus("ended");
    cleanup();
    onEndCall();
  }, [cleanup, onEndCall]);

  // Format duration function
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  // Get status color function
  const getStatusColor = useCallback((): string => {
    switch (callStatus) {
      case "connected":
        return "bg-green-500";
      case "listening":
        return "bg-blue-500";
      case "speaking":
        return "bg-purple-500";
      case "thinking":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  }, [callStatus]);

  // Get status text function
  const getStatusText = useCallback((): string => {
    switch (callStatus) {
      case "connecting":
        return "Menghubungkan...";
      case "connected":
        return "Terhubung";
      case "listening":
        return "Mendengarkan...";
      case "speaking":
        return `${config.aiName} berbicara...`;
      case "thinking":
        return `${config.aiName} berpikir...`;
      case "error":
        return "Error";
      case "ended":
        return "Panggilan berakhir";
      default:
        return "";
    }
  }, [callStatus, config.aiName]);

  if (callStatus === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-4">Panggilan Gagal</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {errorMessage}
          </p>
          <button
            onClick={endCall}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}
            />
            <span className="font-medium">{getStatusText()}</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatDuration(callDuration)}
          </div>
        </div>
      </div>

      {/* Main Call Interface */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
          {/* AI Avatar */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <div
                className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mb-4 transition-all duration-300 ${
                  isSpeaking ? "scale-110 shadow-lg" : "scale-100"
                }`}
              >
                {config.aiName.charAt(0).toUpperCase()}
              </div>

              {/* Voice Activity Ring */}
              {(isSpeaking || isRecording) && (
                <div
                  className={`absolute inset-0 rounded-full border-4 ${
                    isSpeaking ? "border-purple-400" : "border-blue-400"
                  } animate-ping`}
                />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">{config.aiName}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {callStatus === "speaking"
                ? "Sedang berbicara..."
                : callStatus === "listening"
                ? "Mendengarkan Anda..."
                : callStatus === "thinking"
                ? "Sedang berpikir..."
                : "Siap berbicara"}
            </p>
          </div>

          {/* Current Transcript */}
          {currentTranscript && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                Anda sedang berkata:
              </p>
              <p className="font-medium">{currentTranscript}</p>
            </div>
          )}

          {/* Last AI Response - Show formatted version for display */}
          {lastAIResponse && !isSpeaking && (
            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">
                {config.aiName} berkata:
              </p>
              <p className="font-medium">
                {/* Display a clean version of the response */}
                {formatForVoice(lastAIResponse) ||
                  "Saya sedang memproses respons..."}
              </p>
            </div>
          )}

          {/* Voice Level Indicator */}
          {isRecording && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-blue-400 rounded-full transition-all duration-100 ${
                      audioLevel > i * 10 ? "h-8" : "h-2"
                    }`}
                  />
                ))}
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">
                🎤 Mendengarkan...
              </p>
            </div>
          )}

          {/* Call Controls */}
          <div className="flex justify-center gap-4">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl transition-all duration-200 ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 shadow-lg"
                  : "bg-gray-500 hover:bg-gray-600"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🎤"}
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white text-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              title="End Call"
            >
              📞
            </button>
          </div>

          {/* Connection Status */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div
                className={`w-2 h-2 rounded-full ${
                  callStatus === "connected" ||
                  callStatus === "speaking" ||
                  callStatus === "listening" ||
                  callStatus === "thinking"
                    ? "bg-green-400"
                    : "bg-red-400"
                }`}
              />
              <span>
                {callStatus === "connecting"
                  ? "Menghubungkan ke AI..."
                  : callStatus === "error"
                  ? "Koneksi bermasalah"
                  : "Terhubung ke AI"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation History - Show original responses */}
      {conversationHistory.length > 0 && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Riwayat Percakapan</h3>
              <span className="text-xs text-gray-500">
                {conversationHistory.length} pesan
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-2">
              {conversationHistory.slice(-3).map((message, index) => (
                <div
                  key={index}
                  className={`text-xs p-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-8"
                      : "bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 mr-8"
                  }`}
                >
                  <div className="font-medium mb-1">
                    {message.role === "user" ? config.userName : config.aiName}:
                  </div>
                  <div>
                    {/* Show formatted version for better readability */}
                    {message.role === "assistant"
                      ? formatForVoice(message.content)
                      : message.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {conversationHistory.length === 0 && callStatus === "connected" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <div className="max-w-4xl mx-auto p-4 text-center">
            <p className="text-blue-600 dark:text-blue-400 text-sm">
              💡 Mulai berbicara untuk memulai percakapan dengan {config.aiName}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
