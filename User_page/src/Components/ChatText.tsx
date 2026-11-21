import type { ReactNode } from 'react';

// Renders the small subset of Markdown that Gemini usually returns (bold, bullet and
// numbered lists, inline code). It builds React elements, never raw HTML, so replies cannot inject markup.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*\n]*?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={key} className="font-semibold">{m[1]}</strong>);
    else if (m[2] !== undefined)
      out.push(
        <code key={key} className="px-1 rounded text-[0.92em]" style={{ background: 'var(--border)' }}>
          {m[2]}
        </code>,
      );
    else out.push(<em key={key}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const prev = blocks[blocks.length - 1];

    if (line.trim() === '') {
      blocks.push({ kind: 'p', lines: [] }); // blank line: next text starts a new paragraph
      continue;
    }
    if (bullet) {
      if (prev?.kind === 'ul') prev.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
    } else if (numbered) {
      if (prev?.kind === 'ol') prev.items.push(numbered[1]);
      else blocks.push({ kind: 'ol', items: [numbered[1]] });
    } else if (prev?.kind === 'p') {
      prev.lines.push(line);
    } else {
      blocks.push({ kind: 'p', lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : true));
}

export default function ChatText({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="space-y-1.5 break-words">
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(l, `${i}-${j}`)}
                </span>
              ))}
            </p>
          );
        }
        const Tag = b.kind === 'ul' ? 'ul' : 'ol';
        return (
          <Tag key={i} className={`pl-4 space-y-0.5 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `${i}-${j}`)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
