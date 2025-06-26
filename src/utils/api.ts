import { AIConfig } from "./config";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  message: string;
  success: boolean;
  error?: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class APIClient {
  private config: AIConfig;
  private context: number[] = [];

  constructor(config: AIConfig) {
    this.config = this.validateConfig(config);
  }

  private validateConfig(config: AIConfig): AIConfig {
    return {
      ...config,
      maxTokens: Math.max(config.maxTokens, 1500),
      temperature: Math.min(Math.max(config.temperature, 0.1), 1.2),
    };
  }

  updateConfig(config: AIConfig) {
    this.config = this.validateConfig(config);
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error("Failed to connect to Ollama:", error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }

      const data = await response.json();
      return data.models?.map((model: { name: string }) => model.name) || [];
    } catch (error) {
      console.error("Failed to get available models:", error);
      return [];
    }
  }

  // Helper untuk membuat prompt yang lebih tegas tentang bahasa Indonesia
  private buildStructuredPrompt(
    message: string,
    conversationHistory: ChatMessage[] = []
  ): string {
    const systemPrompt = `Kamu adalah Asistenqu, asisten AI berbahasa Indonesia.

ATURAN PENTING:
1. WAJIB berbicara dalam bahasa Indonesia SAJA, jangan gunakan bahasa lain
2. Jika perlu berpikir: <think>pemikiran dalam bahasa Indonesia</think>
3. SELALU tutup tag </think> sebelum respons
4. Respons maksimal 2-3 kalimat setelah </think>
5. Gunakan gaya bicara natural dan ramah

Contoh format yang benar:
<think>Saya perlu menjawab pertanyaan user dengan ramah</think>
Halo! Saya baik-baik saja, terima kasih sudah bertanya.

Hindari:
- Bahasa Inggris atau bahasa lain
- Respons terlalu panjang
- Tag <think> tidak ditutup

Kamu sedang berbicara via voice call.`;

    let prompt = systemPrompt + "\n\n";

    // Add conversation history (last 3 messages saja untuk menghindari confusion)
    const recentHistory = conversationHistory.slice(-3);
    for (const msg of recentHistory) {
      if (msg.role === "user") {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === "assistant") {
        prompt += `Asistenqu: ${msg.content}\n`;
      }
    }

    prompt += `User: ${message}\nAsistenqu: `;

    return prompt;
  }

  // Perbaiki validasi response
  private validateResponse(response: string): {
    isComplete: boolean;
    cleaned: string;
    issues: string[];
  } {
    const issues: string[] = [];
    let cleaned = response.trim();

    console.log("🔍 Validating response:", response);

    // Cek tag <think> yang tidak ditutup
    const openThinkTags = (response.match(/<think>/g) || []).length;
    const closeThinkTags = (response.match(/<\/think>/g) || []).length;

    if (openThinkTags > closeThinkTags) {
      issues.push("Incomplete <think> tags detected");

      // Hapus <think> yang tidak lengkap dari akhir
      const lastOpenThink = response.lastIndexOf("<think>");
      const lastCloseThink = response.lastIndexOf("</think>");

      if (lastOpenThink > lastCloseThink) {
        cleaned = response.substring(0, lastOpenThink).trim();
      }
    }

    // Cek bahasa non-Indonesia (seperti Chinese characters)
    if (/[\u4e00-\u9fff]/.test(response)) {
      issues.push("Contains non-Indonesian characters");
    }

    // PERBAIKAN: Jangan flag sebagai truncated jika response sudah selesai dengan proper punctuation
    const hasProperEnding = /[.!?。][\s]*$/.test(response.trim());
    const hasThinkingComplete = openThinkTags === closeThinkTags;

    // Hanya flag sebagai truncated jika benar-benar tidak lengkap
    if (response.length > 50 && !hasProperEnding && !hasThinkingComplete) {
      issues.push("Response appears to be truncated");
    }

    // Jika tidak ada content setelah dibersihkan
    if (!cleaned || cleaned === "Asistenqu:") {
      cleaned = "Maaf, bisa tolong ulangi pertanyaannya?";
    }

    console.log("🔍 Validation result:", {
      issues,
      cleaned,
      isComplete: issues.length === 0,
    });

    return {
      isComplete: issues.length === 0,
      cleaned: cleaned,
      issues,
    };
  }

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    try {
      const prompt = this.buildStructuredPrompt(message, conversationHistory);

      console.log("🤖 Sending prompt:", prompt);

      const requestBody = {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
          stop: ["User:", "\nUser:", "Human:", "\nHuman:", "user:", "\nuser:"],
          top_k: 40,
          top_p: 0.9,
          repeat_penalty: 1.1,
          // Tambahkan seed untuk konsistensi
          seed: Math.floor(Math.random() * 1000000),
        },
        context: this.context.length > 0 ? this.context : undefined,
      };

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: OllamaResponse = await response.json();

      console.log("🤖 Raw response:", data.response);

      // Validasi response
      const validation = this.validateResponse(data.response);

      // Update context
      if (data.context) {
        this.context = data.context;
      }

      // Jika ada masalah serius (incomplete thinking atau bahasa salah), retry
      if (
        !validation.isComplete &&
        (validation.issues.includes("Incomplete <think> tags detected") ||
          validation.issues.includes("Contains non-Indonesian characters"))
      ) {
        console.warn(
          "⚠️ Response has serious issues, retrying with simple prompt...",
          validation.issues
        );
        return this.sendSimpleMessage(message, conversationHistory);
      }

      return {
        message: validation.cleaned,
        success: true,
      };
    } catch (error) {
      console.error("API Error:", error);
      return {
        message: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // Simplified fallback method
  private async sendSimpleMessage(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    try {
      console.log("🔄 Using fallback simple message");

      // Prompt super sederhana dan tegas
      const simplePrompt = `Kamu adalah Asistenqu. Jawab HANYA dalam bahasa Indonesia, maksimal 2 kalimat, natural dan ramah.

User: ${message}
Asistenqu: `;

      const requestBody = {
        model: this.config.model,
        prompt: simplePrompt,
        stream: false,
        options: {
          temperature: 0.7, // Lower temperature
          num_predict: 200, // Shorter response
          stop: ["User:", "\nUser:", "user:", "\nuser:"],
          top_k: 20,
          top_p: 0.8,
        },
        // Don't use context in fallback to avoid confusion
      };

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: OllamaResponse = await response.json();

      let cleanResponse = data.response.trim();

      // Clean up response - remove any non-Indonesian text
      cleanResponse = cleanResponse.replace(/[\u4e00-\u9fff]/g, "");
      cleanResponse = cleanResponse.replace(
        /[^\u0000-\u007F\u00A0-\u00FFÀ-ÿ]/g,
        ""
      );

      if (!cleanResponse) {
        cleanResponse = "Halo! Ada yang bisa saya bantu?";
      }

      console.log("🔄 Fallback response:", cleanResponse);

      return {
        message: cleanResponse,
        success: true,
      };
    } catch (error) {
      return {
        message: "Halo! Ada yang bisa saya bantu?",
        success: false,
        error: error instanceof Error ? error.message : "Fallback error",
      };
    }
  }

  async sendMessageStream(
    message: string,
    conversationHistory: ChatMessage[] = [],
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    try {
      const prompt = this.buildStructuredPrompt(message, conversationHistory);

      const requestBody = {
        model: this.config.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
          stop: ["User:", "\nUser:", "Human:", "\nHuman:", "user:", "\nuser:"],
          top_k: 40,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
        context: this.context.length > 0 ? this.context : undefined,
      };

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let fullResponse = "";
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data: OllamaResponse = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                if (onChunk) {
                  onChunk(data.response);
                }
              }

              if (data.done && data.context) {
                this.context = data.context;
              }
            } catch {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const validation = this.validateResponse(fullResponse);

      return {
        message: validation.cleaned,
        success: true,
      };
    } catch (error) {
      console.error("API Stream Error:", error);
      return {
        message: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  clearContext() {
    this.context = [];
  }
}

// Singleton instance
let apiClient: APIClient | null = null;

export const getAPIClient = (config?: AIConfig): APIClient => {
  if (!apiClient && config) {
    apiClient = new APIClient(config);
  } else if (apiClient && config) {
    apiClient.updateConfig(config);
  }

  if (!apiClient) {
    throw new Error("API client not initialized. Please provide config.");
  }

  return apiClient;
};

// Helper function for Next.js API routes
export const createAPIHandler = () => {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { message, config, conversationHistory } = await req.json();

      const client = new APIClient(config);
      const response = await client.sendMessage(message, conversationHistory);

      return new Response(JSON.stringify(response), {
        status: response.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("API Handler Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
};
