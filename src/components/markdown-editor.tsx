"use client";

import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={[markdown({ base: markdownLanguage })]}
      onChange={handleChange}
      style={{ height: "100%" }}
    />
  );
}
