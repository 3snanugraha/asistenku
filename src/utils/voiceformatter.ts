/**
 * Voice Formatter untuk membersihkan response AI sebelum TTS
 * Menghapus tag <think>, markdown, dan formatting lainnya
 */

export interface VoiceFormatterOptions {
  removeThinkTags?: boolean;
  removeMarkdown?: boolean;
  removeEmojis?: boolean;
  removeAIPrefix?: boolean;
  normalizeWhitespace?: boolean;
  maxLength?: number;
}

const DEFAULT_OPTIONS: VoiceFormatterOptions = {
  removeThinkTags: true,
  removeMarkdown: true,
  removeEmojis: true,
  removeAIPrefix: true,
  normalizeWhitespace: true,
  maxLength: 500, // Batas maksimal karakter untuk TTS
};

/**
 * Membersihkan response AI untuk TTS
 */
export const formatForTTS = (
  text: string,
  options: VoiceFormatterOptions = {}
): string => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let formatted = text;

  // 1. Hapus tag <think>...</think> (case insensitive, multiline)
  if (opts.removeThinkTags) {
    formatted = formatted.replace(/<think>[\s\S]*?<\/think>/gi, "");
  }

  // 2. Hapus prefix AI name (Asistenqu:, AI:, Assistant:, dll)
  if (opts.removeAIPrefix) {
    formatted = formatted.replace(/^(Asistenqu|AI|Assistant|Bot):\s*/gi, "");
  }

  // 3. Hapus markdown formatting
  if (opts.removeMarkdown) {
    // Bold (**text** atau __text__)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "$1");
    formatted = formatted.replace(/__(.*?)__/g, "$1");

    // Italic (*text* atau _text_)
    formatted = formatted.replace(/\*(.*?)\*/g, "$1");
    formatted = formatted.replace(/_(.*?)_/g, "$1");

    // Code blocks (```code``` atau `code`)
    formatted = formatted.replace(/```[\s\S]*?```/g, "");
    formatted = formatted.replace(/`([^`]+)`/g, "$1");

    // Links [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Headers (# ## ###)
    formatted = formatted.replace(/^#{1,6}\s+/gm, "");

    // Lists (- * +)
    formatted = formatted.replace(/^[\s]*[-*+]\s+/gm, "");
  }

  // 4. Hapus emoji (opsional)
  if (opts.removeEmojis) {
    // Regex untuk emoji Unicode
    formatted = formatted.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ""
    );

    // Emoji shortcodes (:smile:, :heart:, dll)
    formatted = formatted.replace(/:[a-zA-Z0-9_+-]+:/g, "");
  }

  // 5. Bersihkan HTML tags lainnya
  formatted = formatted.replace(/<[^>]*>/g, "");

  // 6. Normalize whitespace
  if (opts.normalizeWhitespace) {
    // Hapus multiple spaces
    formatted = formatted.replace(/\s+/g, " ");

    // Hapus multiple newlines
    formatted = formatted.replace(/\n\s*\n/g, "\n");

    // Trim whitespace
    formatted = formatted.trim();
  }

  // 7. Potong jika terlalu panjang
  if (opts.maxLength && formatted.length > opts.maxLength) {
    // Potong di kata terakhir yang lengkap
    const truncated = formatted.substring(0, opts.maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    formatted = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;

    // Tambahkan indikator bahwa text dipotong
    if (formatted.length < text.length) {
      formatted += "...";
    }
  }

  return formatted;
};

/**
 * Formatter khusus untuk conversation context
 * Lebih aggressive dalam membersihkan text
 */
export const formatForConversation = (text: string): string => {
  return formatForTTS(text, {
    removeThinkTags: true,
    removeMarkdown: false, // Keep some markdown for context
    removeEmojis: false, // Keep emojis for context
    removeAIPrefix: true,
    normalizeWhitespace: true,
    maxLength: undefined, // No length limit for conversation
  });
};

/**
 * Formatter khusus untuk display UI
 * Mempertahankan formatting visual
 */
export const formatForDisplay = (text: string): string => {
  return formatForTTS(text, {
    removeThinkTags: true,
    removeMarkdown: false, // Keep markdown for display
    removeEmojis: false, // Keep emojis for display
    removeAIPrefix: false, // Keep AI prefix for clarity
    normalizeWhitespace: true,
    maxLength: undefined,
  });
};

/**
 * Deteksi apakah text mengandung tag <think>
 */
export const hasThinkTags = (text: string): boolean => {
  return /<think>[\s\S]*?<\/think>/gi.test(text);
};

/**
 * Ekstrak hanya content dari tag <think>
 * Berguna untuk debugging atau logging
 */
export const extractThinkContent = (text: string): string[] => {
  const matches = text.match(/<think>([\s\S]*?)<\/think>/gi);
  if (!matches) return [];

  return matches.map((match) => match.replace(/<\/?think>/gi, "").trim());
};

/**
 * Validasi text untuk TTS
 * Memastikan text aman untuk diucapkan
 */
export const validateForTTS = (
  text: string
): {
  isValid: boolean;
  issues: string[];
  cleaned: string;
} => {
  const issues: string[] = [];

  // Cek tag <think>
  if (hasThinkTags(text)) {
    issues.push("Contains <think> tags");
  }

  // Cek panjang text
  if (text.length > 1000) {
    issues.push("Text too long for TTS");
  }

  // Cek karakter khusus yang bermasalah
  if (/[<>{}[\]]/g.test(text)) {
    issues.push("Contains problematic characters");
  }

  const cleaned = formatForTTS(text);

  return {
    isValid: issues.length === 0,
    issues,
    cleaned,
  };
};

// Helper untuk testing
export const testFormatter = () => {
  const testText = `Asistenqu:<think> Okay, the user asked about my current status. I should respond in a friendly and conversational way. </think> Hei! **Terima kasih** kabar! Saya juga sedang berada di sini untuk membantu Anda. 😊`;

  console.log("Original:", testText);
  console.log("Formatted:", formatForTTS(testText));
  console.log("Has think tags:", hasThinkTags(testText));
  console.log("Think content:", extractThinkContent(testText));
  console.log("Validation:", validateForTTS(testText));
};
