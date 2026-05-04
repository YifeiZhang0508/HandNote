"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface ImageFile {
  id: string;
  base64: string;
  mimeType: string;
  preview: string;
  name: string;
}

interface ImageUploaderProps {
  onConfirm: (images: ImageFile[]) => void;
  isProcessing: boolean;
  hasExistingContent: boolean;
  onClear: () => void;
  onMarkdownUpload: (content: string) => void;
}

export default function ImageUploader({
  onConfirm,
  isProcessing,
  hasExistingContent,
  onClear,
  onMarkdownUpload,
}: ImageUploaderProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const processMarkdownFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onMarkdownUpload(text);
    };
    reader.readAsText(file);
  }, [onMarkdownUpload]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const mdFiles = fileArray.filter((f) => f.name.endsWith(".md"));
    const imageFiles = fileArray.filter((f) => !f.name.endsWith(".md"));

    mdFiles.forEach((f) => processMarkdownFile(f));

    const validImages = imageFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} 不是图片文件，已跳过`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} 超过10MB限制，已跳过`);
        return false;
      }
      return true;
    });

    for (const file of validImages) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(",")[1];
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setImages((prev) => [
          ...prev,
          { id, base64, mimeType: file.type, preview: result, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }, [processMarkdownFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) processFiles(files);
    },
    [processFiles]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleConfirm() {
    if (images.length === 0) return;
    onConfirm(images);
    setImages([]);
  }

  const disabled = isProcessing;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer min-h-[140px]
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-zinc-300 hover:border-zinc-400"}
          ${disabled ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.md,text/markdown"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 16V4m0 0L8 8m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
            />
          </svg>
          <p className="text-sm font-medium">拖拽或点击上传图片（可多选）</p>
          <p className="text-xs text-zinc-400">
            支持 JPG / PNG / WebP / GIF，也可 Ctrl+V 粘贴截图。可拖拽 .md 文件导入
          </p>
        </div>
      </div>

      {/* Upload .md button */}
      <input
        ref={mdInputRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processMarkdownFile(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => mdInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        上传 .md 文件
      </button>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              <img
                src={img.preview}
                alt={img.name}
                className="h-24 w-full rounded-lg border border-zinc-200 object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <div className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                {img.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {images.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            确认提交 {images.length > 1 ? `(${images.length} 张)` : ""}
          </button>
        )}
        {hasExistingContent && (
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50"
          >
            清除重来
          </button>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          正在识别中，请稍候...
        </div>
      )}
    </div>
  );
}
