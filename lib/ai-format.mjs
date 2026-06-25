export function formatAI(text) {
  if (!text) return "";

  // hapus tag think kalau ada
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  const patterns = [
    /Hai! Saya/i,
    /Halo! Saya/i,
    /Hello!/i,
    /Saya adalah/i,
    /Aku adalah/i
  ];

  let cut = -1;

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      cut = m.index;
      break;
    }
  }

  if (cut > 0) {
    text = text.slice(cut);
  }

  return text.trim();
}
