"use client";

import React, { useState, useEffect } from "react";
import {
  ConfigManager,
  AppConfig,
  DEFAULT_CONFIG,
  SUPPORTED_LANGUAGES,
  AVAILABLE_MODELS,
  getAvailableVoices,
  getBestVoiceForLanguage,
} from "@/utils/config";
import { getAPIClient } from "@/utils/api";

interface UserPreferencesDialogProps {
  isOpen: boolean;
  onClose: (config: AppConfig) => void;
  initialConfig?: AppConfig;
}

export default function UserPreferencesDialog({
  isOpen,
  onClose,
  initialConfig,
}: UserPreferencesDialogProps) {
  const [config, setConfig] = useState<AppConfig>(
    initialConfig || DEFAULT_CONFIG
  );
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "error"
  >("checking");
  const [step, setStep] = useState(1);
  const [testingVoice, setTestingVoice] = useState(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);
    };

    loadVoices();

    // Some browsers need time to load voices
    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ("speechSynthesis" in window) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Check Ollama connection and get models
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const client = getAPIClient(config.ai);
        const isConnected = await client.checkConnection();

        if (isConnected) {
          const models = await client.getAvailableModels();
          setAvailableModels(models);
          setConnectionStatus("connected");
        } else {
          setConnectionStatus("error");
        }
      } catch (error) {
        console.error("Connection check failed:", error);
        setConnectionStatus("error");
      }
    };

    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, config.ai.baseUrl, config.ai]);

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const updateAIConfig = (updates: Partial<AppConfig["ai"]>) => {
    setConfig((prev) => ({
      ...prev,
      ai: { ...prev.ai, ...updates },
    }));
  };

  const updateVoiceConfig = (updates: Partial<AppConfig["voice"]>) => {
    setConfig((prev) => ({
      ...prev,
      voice: { ...prev.voice, ...updates },
    }));
  };

  const updateSpeechConfig = (
    updates: Partial<AppConfig["speechRecognition"]>
  ) => {
    setConfig((prev) => ({
      ...prev,
      speechRecognition: { ...prev.speechRecognition, ...updates },
    }));
  };

  const testVoice = async () => {
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis tidak didukung di browser ini");
      return;
    }

    setTestingVoice(true);

    try {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(
        `Halo ${config.userName}, saya ${config.aiName}. Ini adalah tes suara saya.`
      );

      const voice = getBestVoiceForLanguage(config.voice.language);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = config.voice.rate;
      utterance.pitch = config.voice.pitch;
      utterance.volume = config.voice.volume;
      utterance.lang = config.voice.language;

      utterance.onend = () => setTestingVoice(false);
      utterance.onerror = () => setTestingVoice(false);

      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Voice test failed:", error);
      setTestingVoice(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Save configuration
      ConfigManager.saveConfig(config);

      // Close dialog and return config
      onClose(config);
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Gagal menyimpan konfigurasi");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">🎙️</span>
            Setup Asistenqu Voice AI
          </h2>
          <p className="mt-2 opacity-90">
            Konfigurasikan asisten AI voice Anda - Step {step} dari 4
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">👤 Informasi Dasar</h3>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nama Anda
                </label>
                <input
                  type="text"
                  value={config.userName}
                  onChange={(e) => updateConfig({ userName: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Masukkan nama Anda"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nama Asisten AI
                </label>
                <input
                  type="text"
                  value={config.aiName}
                  onChange={(e) => updateConfig({ aiName: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Nama untuk asisten AI Anda"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bahasa</label>
                <select
                  value={config.voice.language}
                  onChange={(e) => {
                    const lang = e.target.value;
                    updateVoiceConfig({ language: lang });
                    updateSpeechConfig({ language: lang });
                  }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: AI Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">🤖 Konfigurasi AI</h3>

              {/* Connection Status */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg">
                    {connectionStatus === "checking" && "⏳"}
                    {connectionStatus === "connected" && "✅"}
                    {connectionStatus === "error" && "❌"}
                  </span>
                  <span className="font-medium">
                    Status Koneksi Ollama:{" "}
                    {connectionStatus === "checking"
                      ? "Memeriksa..."
                      : connectionStatus === "connected"
                      ? "Terhubung"
                      : "Error"}
                  </span>
                </div>
                {connectionStatus === "error" && (
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    Pastikan Ollama berjalan di {config.ai.baseUrl}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Ollama Base URL
                </label>
                <input
                  type="text"
                  value={config.ai.baseUrl}
                  onChange={(e) => updateAIConfig({ baseUrl: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="http://localhost:11434"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Model AI
                </label>
                <select
                  value={config.ai.model}
                  onChange={(e) => updateAIConfig({ model: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Temperature ({config.ai.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.ai.temperature}
                  onChange={(e) =>
                    updateAIConfig({ temperature: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Konservatif</span>
                  <span>Kreatif</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Voice Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">
                🗣️ Konfigurasi Suara
              </h3>

              <div>
                <label className="block text-sm font-medium mb-2">Suara</label>
                <select
                  value={config.voice.voiceURI}
                  onChange={(e) =>
                    updateVoiceConfig({ voiceURI: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Default Voice</option>
                  {availableVoices
                    .filter((voice) =>
                      voice.lang.startsWith(config.voice.language.split("-")[0])
                    )
                    .map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Kecepatan Bicara ({config.voice.rate})
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={config.voice.rate}
                  onChange={(e) =>
                    updateVoiceConfig({ rate: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Lambat</span>
                  <span>Cepat</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pitch ({config.voice.pitch})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.voice.pitch}
                  onChange={(e) =>
                    updateVoiceConfig({ pitch: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Rendah</span>
                  <span>Tinggi</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Volume ({config.voice.volume})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.voice.volume}
                  onChange={(e) =>
                    updateVoiceConfig({ volume: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Pelan</span>
                  <span>Keras</span>
                </div>
              </div>

              <button
                onClick={testVoice}
                disabled={testingVoice}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {testingVoice ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Testing Voice...
                  </>
                ) : (
                  <>
                    <span>🔊</span>
                    Test Voice
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 4: Summary & Save */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">
                📋 Ringkasan Konfigurasi
              </h3>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Nama Anda:</span>
                  <span>{config.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Nama AI:</span>
                  <span>{config.aiName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Bahasa:</span>
                  <span>
                    {
                      SUPPORTED_LANGUAGES.find(
                        (l) => l.code === config.voice.language
                      )?.name
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Model AI:</span>
                  <span>{config.ai.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Temperature:</span>
                  <span>{config.ai.temperature}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status Ollama:</span>
                  <span
                    className={
                      connectionStatus === "connected"
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {connectionStatus === "connected"
                      ? "✅ Terhubung"
                      : "❌ Error"}
                  </span>
                </div>
              </div>

              {connectionStatus === "error" && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-2">
                    ⚠️ Peringatan: Koneksi Ollama Error
                  </p>
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    Pastikan Ollama berjalan dan model tersedia sebelum memulai
                    voice call.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">
                  🎉 Siap untuk Voice Call!
                </p>
                <p className="text-blue-600 dark:text-blue-400 text-sm">
                  Konfigurasi akan disimpan dan Anda bisa memulai percakapan
                  dengan {config.aiName}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 p-6 flex justify-between items-center">
          <div className="flex space-x-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i === step
                    ? "bg-blue-500"
                    : i < step
                    ? "bg-green-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Kembali
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Lanjut
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isLoading || connectionStatus === "checking"}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    Simpan & Mulai
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
