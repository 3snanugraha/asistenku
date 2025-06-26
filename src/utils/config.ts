export interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl: string;
}

export interface VoiceConfig {
  language: string;
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface AppConfig {
  ai: AIConfig;
  voice: VoiceConfig;
  speechRecognition: SpeechRecognitionConfig;
  userName: string;
  aiName: string;
}

// Default configuration
export const DEFAULT_CONFIG: AppConfig = {
  ai: {
    model: "qwen2.5:0.5b",
    temperature: 0.7,
    maxTokens: 1000,
    baseUrl: "http://localhost:11434",
  },
  voice: {
    language: "id-ID",
    voiceURI: "",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  },
  speechRecognition: {
    language: "id-ID",
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
  },
  userName: "User",
  aiName: "Asistenqu",
};

// Available languages
export const SUPPORTED_LANGUAGES = [
  { code: "id-ID", name: "Bahasa Indonesia", voice: "id-ID" },
  { code: "en-US", name: "English (US)", voice: "en-US" },
  { code: "en-GB", name: "English (UK)", voice: "en-GB" },
];

// Available AI models (for Ollama)
export const AVAILABLE_MODELS = [
  { id: "qwen2.5:0.5b", name: "Qwen2.5 0.5B (Fast)", size: "0.5B" },
  { id: "qwen2.5:1.5b", name: "Qwen2.5 1.5B (Balanced)", size: "1.5B" },
  { id: "qwen2.5:3b", name: "Qwen2.5 3B (Quality)", size: "3B" },
];

// Configuration management
export class ConfigManager {
  private static readonly STORAGE_KEY = "voice-ai-config";

  static loadConfig(): AppConfig {
    if (typeof window === "undefined") {
      return DEFAULT_CONFIG;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsedConfig };
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }

    return DEFAULT_CONFIG;
  }

  static saveConfig(config: AppConfig): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error("Error saving config:", error);
    }
  }

  static resetConfig(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Error resetting config:", error);
    }
  }

  static isConfigured(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  static updateConfig(updates: Partial<AppConfig>): AppConfig {
    const currentConfig = this.loadConfig();
    const newConfig = { ...currentConfig, ...updates };
    this.saveConfig(newConfig);
    return newConfig;
  }
}

// Voice synthesis helpers
export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  return speechSynthesis.getVoices();
};

export const getBestVoiceForLanguage = (
  language: string
): SpeechSynthesisVoice | null => {
  const voices = getAvailableVoices();

  // Try to find exact match
  let voice = voices.find((v) => v.lang === language);

  // If not found, try to find language match (e.g., 'id' for 'id-ID')
  if (!voice) {
    const langCode = language.split("-")[0];
    voice = voices.find((v) => v.lang.startsWith(langCode));
  }

  // Fallback to default voice
  if (!voice && voices.length > 0) {
    voice = voices.find((v) => v.default) || voices[0];
  }

  return voice || null;
};
