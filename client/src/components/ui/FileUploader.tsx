import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { validateImageFile } from '@/lib/validation';
import Button from './Button';

interface FileUploaderProps {
  file: File | null;
  onSelect: (file: File | null) => void;
  error?: string;
  maxMb?: number;
  label?: string;
  hint?: string;
  existingUrl?: string | null;
  className?: string;
}

/** Accessible image picker with drag & drop and local preview (§28). */
export const FileUploader = ({ file, onSelect, error, maxMb = 5, label = 'Evidence image (optional)', hint, existingUrl, className }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (!selected) return;
    const validationError = validateImageFile(selected, maxMb);
    if (validationError) {
      setLocalError(validationError);
      onSelect(null);
      return;
    }
    setLocalError(null);
    onSelect(selected);
  };

  const clear = () => {
    setLocalError(null);
    onSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const shownError = error ?? localError;

  return (
    <div className={cn('w-full', className)}>
      <span className="label">{label}</span>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-soft/70' : 'border-line bg-elevated/50',
          shownError && 'border-danger bg-danger-soft/40',
        )}
      >
        {preview ? (
          <div className="w-full">
            <img src={preview} alt="Selected evidence preview" className="mx-auto max-h-56 rounded-lg border border-line object-contain" />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
              <span className="max-w-[220px] truncate font-medium text-ink">{file?.name}</span>
              <span>• {formatFileSize(file?.size)}</span>
              <Button variant="secondary" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={clear}>
                Remove
              </Button>
            </div>
          </div>
        ) : existingUrl ? (
          <div className="w-full">
            <img src={existingUrl} alt="Uploaded evidence" className="mx-auto max-h-56 rounded-lg border border-line object-contain" loading="lazy" />
            <p className="mt-2 text-xs text-muted">A previously uploaded image is attached to this complaint.</p>
            <Button variant="secondary" size="sm" className="mt-2" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => inputRef.current?.click()}>
              Replace image
            </Button>
          </div>
        ) : (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary">
              <UploadCloud className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">Drag and drop an image here</p>
            <p className="mt-0.5 text-xs text-muted">JPG, JPEG, PNG or WEBP • up to {maxMb} MB</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
          aria-label={label}
        />
      </div>

      {shownError ? (
        <p className="field-message" role="alert">
          {shownError}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
};

export default FileUploader;
