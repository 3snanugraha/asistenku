/**
 * Voice Formatter Utility - Enhanced with debugging
 * Formats AI responses to be more suitable for text-to-speech synthesis
 */

export interface VoiceFormatterConfig {
  removeThinkTags: boolean;
  removeMarkdown: boolean;
  removeEmoticons: boolean;
  normalizeNumbers: boolean;
  normalizePunctuation: boolean;
  maxLength?: number;
  debug?: boolean; // Add debug flag
}

export const DEFAULT_VOICE_CONFIG: VoiceFormatterConfig = {
  removeThinkTags: true,
  removeMarkdown: true,
  removeEmoticons: true,
  normalizeNumbers: true,
  normalizePunctuation: true,
  maxLength: 500,
  debug: false, // Set to true for debugging
};

export class VoiceFormatter {
  private config: VoiceFormatterConfig;

  constructor(config: VoiceFormatterConfig = DEFAULT_VOICE_CONFIG) {
    this.config = config;
  }

  /**
   * Main method to format AI response for voice synthesis
   */
  formatForVoice(text: string): string {
    if (this.config.debug) {
      console.log("🎙️ [VoiceFormatter] Original text:", text);
    }

    let formattedText = text;

    // Remove think tags and content - MOST IMPORTANT STEP
    if (this.config.removeThinkTags) {
      const beforeThink = formattedText;
      formattedText = this.removeThinkTags(formattedText);
      if (this.config.debug) {
        console.log(
          "🎙️ [VoiceFormatter] After removing think tags:",
          formattedText
        );
        console.log(
          "🎙️ [VoiceFormatter] Think tags removed?",
          beforeThink !== formattedText
        );
      }
    }

    // Remove markdown formatting
    if (this.config.removeMarkdown) {
      formattedText = this.removeMarkdown(formattedText);
    }

    // Remove emoticons and emojis
    if (this.config.removeEmoticons) {
      formattedText = this.removeEmoticons(formattedText);
    }

    // Normalize numbers for better pronunciation
    if (this.config.normalizeNumbers) {
      formattedText = this.normalizeNumbers(formattedText);
    }

    // Normalize punctuation for better speech flow
    if (this.config.normalizePunctuation) {
      formattedText = this.normalizePunctuation(formattedText);
    }

    // Clean up extra whitespace and special characters
    formattedText = this.cleanupText(formattedText);

    // Limit length if specified
    if (this.config.maxLength) {
      formattedText = this.limitLength(formattedText, this.config.maxLength);
    }

    const finalResult = formattedText.trim();

    if (this.config.debug) {
      console.log("🎙️ [VoiceFormatter] Final result:", finalResult);
    }

    return finalResult;
  }

  /**
   * Remove <think> tags and their content - Enhanced version
   */
  private removeThinkTags(text: string): string {
    if (!text) return text;

    let cleaned = text;

    // Multiple patterns to catch different think tag formats
    const thinkPatterns = [
      // Standard think tags
      /<think>[\s\S]*?<\/think>/gi,
      // Think tags with variations
      /<think[^>]*>[\s\S]*?<\/think>/gi,
      // Think blocks without proper closing
      /<think>[\s\S]*$/gi,
      // Think text patterns (common AI response patterns)
      /think[\s]*:[\s\S]*?(?=\n\n|$)/gi,
      // Lines starting with "think" (common in AI responses)
      /^think[\s\S]*?(?=\n[A-Z]|\n\n|$)/gim,
    ];

    thinkPatterns.forEach((pattern) => {
      const before = cleaned;
      cleaned = cleaned.replace(pattern, "");
      if (this.config.debug && before !== cleaned) {
        console.log("🎙️ [VoiceFormatter] Pattern matched:", pattern);
      }
    });

    // Additional cleanup for common AI thinking patterns
    cleaned = cleaned.replace(/^.*?think.*?$/gim, ""); // Remove lines containing 'think'
    cleaned = cleaned.replace(/Okay,.*?Let me.*?$/gim, ""); // Remove common AI thinking phrases
    cleaned = cleaned.replace(/I need to.*?$/gim, ""); // Remove AI internal thoughts
    cleaned = cleaned.replace(/First,.*?Then,.*?$/gim, ""); // Remove step-by-step thinking

    return cleaned;
  }

  /**
   * Remove markdown formatting
   */
  private removeMarkdown(text: string): string {
    let cleaned = text;

    // Remove code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

    // Remove headers
    cleaned = cleaned.replace(/^#+\s+/gm, "");

    // Remove bold and italic
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
    cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
    cleaned = cleaned.replace(/_([^_]+)_/g, "$1");

    // Remove links
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Remove lists
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "");
    cleaned = cleaned.replace(/^\d+\.\s+/gm, "");

    // Remove blockquotes
    cleaned = cleaned.replace(/^>\s+/gm, "");

    return cleaned;
  }

  /**
   * Remove emoticons and emojis
   */
  private removeEmoticons(text: string): string {
    let cleaned = text;

    // Remove Unicode emojis
    cleaned = cleaned.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ""
    );

    // Remove common emoticons
    cleaned = cleaned.replace(/[:;=]-?[)(\[\]{}|\\\/DPpoO@$*><^-]/g, "");
    cleaned = cleaned.replace(/[)(\[\]{}|\\\/DPpoO@$*><^-]-?[:;=]/g, "");

    return cleaned;
  }

  /**
   * Normalize numbers for better pronunciation
   */
  private normalizeNumbers(text: string): string {
    let normalized = text;

    // Convert percentage symbols
    normalized = normalized.replace(/(\d+)%/g, "$1 persen");

    // Convert currency symbols
    normalized = normalized.replace(/Rp\s?(\d+)/g, "$1 rupiah");
    normalized = normalized.replace(/\$(\d+)/g, "$1 dollar");

    return normalized;
  }

  /**
   * Normalize punctuation for better speech flow
   */
  private normalizePunctuation(text: string): string {
    let normalized = text;

    // Replace multiple punctuation marks
    normalized = normalized.replace(/[!]{2,}/g, "!");
    normalized = normalized.replace(/[?]{2,}/g, "?");
    normalized = normalized.replace(/[.]{3,}/g, "...");

    // Convert common abbreviations
    const abbreviations: Record<string, string> = {
      dll: "dan lain lain",
      dsb: "dan sebagainya",
      dst: "dan seterusnya",
      yg: "yang",
      dgn: "dengan",
      utk: "untuk",
      dr: "dari",
      krn: "karena",
      tdk: "tidak",
      blm: "belum",
      sdh: "sudah",
      hrs: "harus",
      kalo: "kalau",
    };

    Object.entries(abbreviations).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, "gi");
      normalized = normalized.replace(regex, full);
    });

    return normalized;
  }

  /**
   * Clean up text from unwanted characters and formatting
   */
  private cleanupText(text: string): string {
    let cleaned = text;

    // Remove extra whitespace and line breaks
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.replace(/\n+/g, " ");

    // Remove special characters that might confuse TTS
    cleaned = cleaned.replace(/[#@$%^&*+=\[\]{}\\|<>]/g, "");

    // Clean up quotes
    cleaned = cleaned.replace(/["'""`]/g, "");

    // Remove parentheses content that might be technical
    cleaned = cleaned.replace(/\([^)]*\)/g, "");

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, " ");

    return cleaned;
  }

  /**
   * Limit text length for reasonable speech duration
   */
  private limitLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to cut at sentence boundary
    const sentences = text.split(/[.!?]+/);
    let result = "";

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if ((result + trimmedSentence + ".").length > maxLength) {
        break;
      }
      result += (result ? " " : "") + trimmedSentence + ".";
    }

    // If no complete sentence fits, cut at word boundary
    if (result.length === 0) {
      const words = text.split(" ");
      while (words.length > 0 && result.length < maxLength) {
        const nextWord = words.shift();
        if ((result + " " + nextWord).length > maxLength) {
          break;
        }
        result += (result ? " " : "") + nextWord;
      }
      result += "."; // Add period for better speech
    }

    return result || text.substring(0, maxLength);
  }

  /**
   * Check if text is suitable for voice synthesis
   */
  isSuitableForVoice(text: string): boolean {
    const formatted = this.formatForVoice(text);
    if (!formatted.trim()) {
      return false;
    }

    // Check if text contains mostly readable characters
    const readableChars = formatted.replace(/[^\w\s.,!?]/g, "").length;
    const totalChars = formatted.length;

    return totalChars > 0 && readableChars / totalChars > 0.5;
  }
}

// Export singleton instance with debug enabled for now
export const voiceFormatter = new VoiceFormatter({
  ...DEFAULT_VOICE_CONFIG,
  debug: true, // Enable debugging
});

// Export utility functions
export const formatForVoice = (
  text: string,
  config?: Partial<VoiceFormatterConfig>
): string => {
  if (config) {
    const formatter = new VoiceFormatter({
      ...DEFAULT_VOICE_CONFIG,
      ...config,
    });
    return formatter.formatForVoice(text);
  }
  return voiceFormatter.formatForVoice(text);
};

export const isVoiceSuitable = (text: string): boolean => {
  return voiceFormatter.isSuitableForVoice(text);
};

// Test function to debug specific responses
export const debugVoiceFormatting = (text: string): void => {
  console.log("🔍 [DEBUG] Testing voice formatting:");
  console.log("Input:", text);
  const result = formatForVoice(text, { debug: true });
  console.log("Output:", result);
  console.log("Suitable for voice:", isVoiceSuitable(text));
};
