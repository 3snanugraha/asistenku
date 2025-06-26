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
    this.config = config;
  }

  updateConfig(config: AIConfig) {
    this.config = config;
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

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    try {
      // Build the prompt with conversation history
      const systemPrompt = `Kamu adalah asisten AI yang ramah dan membantu bernama "Asistenqu". Kamu sedang berbicara melalui panggilan suara dengan pengguna. Jawab dengan natural dan conversational, seperti sedang berbicara langsung. Jaga percakapan tetap menarik dan responsif.`;

      let prompt = systemPrompt + "\n\n";

      // Add conversation history (last 5 messages to keep context reasonable)
      const recentHistory = conversationHistory.slice(-5);
      for (const msg of recentHistory) {
        if (msg.role === "user") {
          prompt += `User: ${msg.content}\n`;
        } else if (msg.role === "assistant") {
          prompt += `Asistenqu: ${msg.content}\n`;
        }
      }

      prompt += `User: ${message}\nAsistenqu:`;

      const requestBody = {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
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

      // Update context for next conversation
      if (data.context) {
        this.context = data.context;
      }

      return {
        message: data.response.trim(),
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

  async sendMessageStream(
    message: string,
    conversationHistory: ChatMessage[] = [],
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = `Kamu adalah asisten AI yang ramah dan membantu bernama "Asistenqu". Kamu sedang berbicara melalui panggilan suara dengan pengguna. Jawab dengan natural dan conversational, seperti sedang berbicara langsung. Jaga percakapan tetap menarik dan responsif.`;

      let prompt = systemPrompt + "\n\n";

      const recentHistory = conversationHistory.slice(-5);
      for (const msg of recentHistory) {
        if (msg.role === "user") {
          prompt += `User: ${msg.content}\n`;
        } else if (msg.role === "assistant") {
          prompt += `Asistenqu: ${msg.content}\n`;
        }
      }

      prompt += `User: ${message}\nAsistenqu:`;

      const requestBody = {
        model: this.config.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
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
                // Fix: Call onChunk properly instead of unused expression
                if (onChunk) {
                  onChunk(data.response);
                }
              }

              if (data.done && data.context) {
                this.context = data.context;
              }
            } catch {
              // Fix: Remove unused parseError variable
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return {
        message: fullResponse.trim(),
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
