"use client";

import { useState, useEffect } from "react";
import { ConfigManager, AppConfig, DEFAULT_CONFIG } from "@/utils/config";
import UserPreferencesDialog from "./components/UserPreferencesDialog";
import VoiceCallInterface from "./components/VoiceCallInterface";

type AppState = "loading" | "setup" | "calling" | "ended";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user has configured the app before
      const isConfigured = ConfigManager.isConfigured();

      if (isConfigured) {
        // Load existing configuration
        const savedConfig = ConfigManager.loadConfig();
        setConfig(savedConfig);
        setAppState("calling");
      } else {
        // First time user - show setup dialog
        setIsFirstTime(true);
        setAppState("setup");
      }
    } catch (error) {
      console.error("Failed to initialize app:", error);
      // If there's an error, show setup dialog
      setAppState("setup");
    }
  };

  const handleSetupComplete = (newConfig: AppConfig) => {
    setConfig(newConfig);
    setAppState("calling");
  };

  const handleCallEnd = () => {
    setAppState("ended");
  };

  const handleStartNewCall = () => {
    setAppState("calling");
  };

  const handleReconfigure = () => {
    setAppState("setup");
  };

  const handleResetApp = () => {
    ConfigManager.resetConfig();
    setConfig(DEFAULT_CONFIG);
    setIsFirstTime(true);
    setAppState("setup");
  };

  // Loading state
  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎙️</div>
          <h1 className="text-2xl font-bold mb-2">Asistenqu Voice AI</h1>
          <p className="text-gray-600 dark:text-gray-400">Memuat aplikasi...</p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Setup state
  if (appState === "setup") {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="text-center max-w-2xl mx-auto p-8">
            <div className="text-8xl mb-6">🎙️</div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Asistenqu Voice AI
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              {isFirstTime
                ? "Selamat datang! Mari konfigurasi asisten AI voice Anda untuk pengalaman yang personal."
                : "Konfigurasi ulang pengaturan asisten AI voice Anda."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🗣️</div>
                <h3 className="font-semibold mb-2">Voice Recognition</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Berbicara langsung dengan AI menggunakan suara Anda
                </p>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="font-semibold mb-2">AI Response</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Respon cerdas dari Ollama AI dengan konfigurasi personal
                </p>
              </div>

              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🔊</div>
                <h3 className="font-semibold mb-2">Text-to-Speech</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mendengar respon AI dengan suara yang natural
                </p>
              </div>
            </div>
          </div>
        </div>

        <UserPreferencesDialog
          isOpen={true}
          onClose={handleSetupComplete}
          initialConfig={config}
        />
      </>
    );
  }

  // Call ended state
  if (appState === "ended") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold mb-4">Panggilan Berakhir</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Terima kasih telah menggunakan Asistenqu Voice AI!
          </p>

          <div className="space-y-3">
            <button
              onClick={handleStartNewCall}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📞</span>
              Panggilan Baru
            </button>

            <button
              onClick={handleReconfigure}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>⚙️</span>
              Ubah Pengaturan
            </button>

            <button
              onClick={handleResetApp}
              className="w-full border border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>🔄</span>
              Reset Aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calling state
  return <VoiceCallInterface config={config} onEndCall={handleCallEnd} />;
}
