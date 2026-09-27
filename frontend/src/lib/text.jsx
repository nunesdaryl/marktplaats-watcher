// The model's light markdown (bold, links) as React elements. No innerHTML: React escapes all text,
// and only marktplaats.nl links become clickable.
function inline(text, key) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/\S+)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${i++}`}>{m[1]}</strong>);
    else {
      const url = m[3] || m[4];
      const label = m[2] || "View listing";
      if (url.startsWith("https://www.marktplaats.nl/"))
        parts.push(<a key={`${key}-${i++}`} href={url} target="_blank" rel="noopener noreferrer">{label}</a>);
      else if (m[2]) parts.push(m[2]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function RichText({ text }) {
  return text.split("\n").filter((l) => l.trim()).map((line, i) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    return bullet ? <p key={i} className="bullet">{inline(bullet[1], i)}</p> : <p key={i}>{inline(line, i)}</p>;
  });
}
