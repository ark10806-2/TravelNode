import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarkdownTextProps = {
  text?: string | null;
  fallback?: string;
  className?: string;
};

type MarkdownBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'code'; text: string };

export function MarkdownText({ text, fallback = '빈 메모', className }: MarkdownTextProps) {
  const value = normalizeMarkdownText(text, fallback);
  const blocks = parseBlocks(value);

  return (
    <div className={cn('space-y-2 break-words leading-6 text-muted-foreground', className)}>
      {blocks.map((block, index) => renderBlock(block, `md-${index}`))}
    </div>
  );
}

export function MarkdownInline({ text, fallback = '빈 메모', className }: MarkdownTextProps) {
  return (
    <span className={cn('break-words', className)}>
      {renderInline(normalizeMarkdownText(text, fallback), 'inline')}
    </span>
  );
}

function normalizeMarkdownText(text: string | null | undefined, fallback: string) {
  return text?.trim() || fallback;
}

function parseBlocks(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      index += index < lines.length ? 1 : 0;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: (heading[1].length + 1) as 2 | 3 | 4, text: heading[2].trim() });
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*((?:[-*])|(?:\d+\.))\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*((?:[-*])|(?:\d+\.))\s+(.+)$/);
        if (!itemMatch || /\d+\./.test(itemMatch[1]) !== ordered) break;
        items.push(itemMatch[2].trim());
        index += 1;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quoteLines.push(lines[index].replace(/^\s?>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', lines: quoteLines });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

function isBlockStart(line: string) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('```') ||
    /^#{1,3}\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^((?:[-*])|(?:\d+\.))\s+/.test(trimmed);
}

function renderBlock(block: MarkdownBlock, key: string) {
  if (block.type === 'heading') {
    const children = renderInline(block.text, key);
    const className = 'font-bold leading-snug text-foreground';
    if (block.level === 2) return <h2 key={key} className={className}>{children}</h2>;
    if (block.level === 3) return <h3 key={key} className={className}>{children}</h3>;
    return <h4 key={key} className={className}>{children}</h4>;
  }

  if (block.type === 'quote') {
    return (
      <blockquote key={key} className="border-l-2 border-border pl-3 text-foreground/75">
        {renderLines(block.lines, key)}
      </blockquote>
    );
  }

  if (block.type === 'ul' || block.type === 'ol') {
    const items = block.items.map((item, index) => (
      <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
    ));
    const className = cn('space-y-1 pl-5', block.type === 'ul' ? 'list-disc' : 'list-decimal');
    return block.type === 'ul' ? <ul key={key} className={className}>{items}</ul> : <ol key={key} className={className}>{items}</ol>;
  }

  if (block.type === 'code') {
    return (
      <pre key={key} className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-5 text-foreground">
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p key={key}>
        {renderLines(block.lines, key)}
      </p>
    );
  }

  return null;
}

function renderLines(lines: string[], keyPrefix: string) {
  return lines.flatMap((line, index) => [
    ...renderInline(line, `${keyPrefix}-${index}`),
    index < lines.length - 1 ? <br key={`${keyPrefix}-${index}-br`} /> : null
  ]);
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    nodes.push(renderInlineToken(match[0], `${keyPrefix}-token-${tokenIndex}`));
    cursor = match.index + match[0].length;
    tokenIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length ? nodes : [text];
}

function renderInlineToken(token: string, key: string): ReactNode {
  if (token.startsWith('`') && token.endsWith('`')) {
    return (
      <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.92em] text-foreground">
        {token.slice(1, -1)}
      </code>
    );
  }

  if (token.startsWith('**') && token.endsWith('**')) {
    return (
      <strong key={key} className="font-bold text-foreground">
        {renderInline(token.slice(2, -2), key)}
      </strong>
    );
  }

  if (token.startsWith('*') && token.endsWith('*')) {
    return (
      <em key={key} className="italic">
        {renderInline(token.slice(1, -1), key)}
      </em>
    );
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (link) {
    const href = safeHref(link[2]);
    if (!href) return token;

    return (
      <a
        key={key}
        className="font-medium text-primary underline underline-offset-4"
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
      >
        {renderInline(link[1], key)}
      </a>
    );
  }

  return token;
}

function safeHref(value: string) {
  const trimmed = value.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return null;
}
