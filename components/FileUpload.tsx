"use client";
import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, FileText, Film, ImageIcon, File as FileIcon } from "lucide-react";
import { formatBytes, uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

// A real upload or a demo placeholder. `file` is undefined for demo chips.
export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  file?: File;
  url?: string; // object URL for previews (real files only)
}

export function makeUploadedFile(file: File): UploadedFile {
  // P2: include PDF so the iframe preview can render
  const isPreviewable =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type === "application/pdf";
  return {
    id: uid(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    file,
    url: isPreviewable ? URL.createObjectURL(file) : undefined,
  };
}

// P2: revoke blob URL on removal/reset to avoid memory leaks
export function revokeUploadedFile(f: UploadedFile) {
  if (f.url) URL.revokeObjectURL(f.url);
}

export function FileUpload({
  files,
  onAdd,
  onRemove,
  disabled,
  multiple = true,
}: {
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const picked = multiple ? Array.from(list) : [list[0]];
      onAdd(picked.map(makeUploadedFile));
    },
    [onAdd, multiple]
  );

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/40",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        <UploadCloud size={20} className="text-muted" />
        <span className="text-xs text-muted">
          <span className="text-accent">Click</span> or drop files — any type
        </span>
        <input
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-2 space-y-2">
        <AnimatePresence initial={false}>
          {files.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FileChip file={f} onRemove={() => onRemove(f.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }: { file: UploadedFile; onRemove: () => void }) {
  const { type, url } = file;
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Preview where possible. */}
      {type.startsWith("image/") && url && (
        <img src={url} alt={file.name} className="max-h-40 w-full object-cover" />
      )}
      {type.startsWith("video/") && url && (
        <video src={url} controls className="max-h-48 w-full bg-black" />
      )}
      {type === "application/pdf" && url && (
        <iframe src={url} title={file.name} className="h-48 w-full bg-white" />
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <Icon type={type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{file.name}</p>
          <p className="text-[11px] text-muted">
            {type || "unknown"} · {formatBytes(file.size)}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-muted hover:text-red-300 transition-colors"
          aria-label={`Remove ${file.name}`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function Icon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon size={16} className="text-muted shrink-0" />;
  if (type.startsWith("video/")) return <Film size={16} className="text-muted shrink-0" />;
  if (type === "application/pdf") return <FileText size={16} className="text-muted shrink-0" />;
  return <FileIcon size={16} className="text-muted shrink-0" />;
}
