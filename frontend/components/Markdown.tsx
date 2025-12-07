"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: (props) => <a {...props} className="text-emerald-300 underline hover:text-emerald-200" />,
        h1: (props) => <h1 {...props} className="text-xl font-semibold mt-4 mb-2" />,
        h2: (props) => <h2 {...props} className="text-lg font-semibold mt-4 mb-2" />,
        h3: (props) => <h3 {...props} className="text-base font-semibold mt-3 mb-2" />,
        p: (props) => <p {...props} className="mt-2" />,
        ul: (props) => <ul {...props} className="list-disc list-inside mt-2 space-y-1" />,
        ol: (props) => <ol {...props} className="list-decimal list-inside mt-2 space-y-1" />,
        li: (props) => <li {...props} className="mt-1" />,
        code: (props) => <code {...props} className="bg-black/40 border border-[color:var(--border)] rounded px-1.5 py-0.5" />,
        pre: (props) => <pre {...props} className="bg-black/40 border border-[color:var(--border)] rounded p-3 overflow-auto" />
      }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}