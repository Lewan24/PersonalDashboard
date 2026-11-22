import { Fragment } from "react";
import { safeUrl } from "../api";
// Deliberately small Markdown grammar: text is always escaped by React, never HTML.
function inline(text: string) {
  return text
    .split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((part, i) => {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link)
        return safeUrl(link[2]) ? (
          <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        ) : (
          <Fragment key={i}>{link[1]}</Fragment>
        );
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i}>{part.slice(1, -1)}</code>;
      return <Fragment key={i}>{part}</Fragment>;
    });
}
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      {text
        .split("\n")
        .map((line, i) =>
          line.startsWith("### ") ? (
            <h4 key={i}>{inline(line.slice(4))}</h4>
          ) : line.startsWith("## ") ? (
            <h3 key={i}>{inline(line.slice(3))}</h3>
          ) : line.startsWith("# ") ? (
            <h3 key={i}>{inline(line.slice(2))}</h3>
          ) : (
            <p key={i}>{inline(line)}</p>
          ),
        )}
    </div>
  );
}
