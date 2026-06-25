import axios from "axios";

export const models = {
  "gpt-5.5": "openai/gpt-5.5",
  "gpt-5.4": "openai/gpt-5.4",
  "gpt-5.3": "openai/gpt-5.3-chat",
  "gpt-5.1": "openai/gpt-5.1-instant",
  "gpt-5": "openai/gpt-5",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",

  "grok": "xai/grok-4.1-fast-non-reasoning",

  "haiku": "anthropic/claude-haiku-4.5",
  "sonnet": "anthropic/claude-sonnet-4.6",
  "opus": "anthropic/claude-opus-4.5",
  "opus46": "anthropic/claude-opus-4.6",
  "opus47": "anthropic/claude-opus-4.7",
  "opus48": "anthropic/claude-opus-4.8",
  "fable": "anthropic/claude-fable-5",

  "deepseek": "deepseek/deepseek-v4-pro",
  "deepseek-flash": "deepseek/deepseek-v4-flash",
  "deepseek-thinking": "deepseek/deepseek-3.2-thinking",

  "gemini": "google/gemini-3.1-pro-preview",
  "gemini3": "google/gemini-3-pro-preview",
  "gemini-flash": "google/gemini-3.1-flash-lite",

  "qwen": "alibaba/qwen3-max",
  "llama": "meta/llama-4-maverick",
  "kimi": "moonshotai/kimi-k2.6"
};


export async function askAI(prompt, model = "gemini") {
  const selected = models[model] || models.gemini;

  const { data } = await axios.get(
    "https://api-nanzz.my.id/docs/api/ai/chatday.php",
    {
      params: {
        prompt,
        model: selected
      },
      timeout: 60000
    }
  );

  if (!data?.status) {
    throw new Error("AI gagal");
  }

  return data.result.response;
}
