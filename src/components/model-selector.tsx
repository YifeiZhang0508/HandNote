"use client";

import { MODELS } from "@/lib/models";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="model-select"
        className="text-xs text-zinc-500"
      >
        模型
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors hover:border-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.provider} / {model.name}
            {model.supportsVision ? "" : " (仅文本)"}
          </option>
        ))}
      </select>
    </div>
  );
}
