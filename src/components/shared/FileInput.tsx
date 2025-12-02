import React, { useRef, useImperativeHandle, forwardRef } from 'react';

interface FileInputProps {
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  formats?: string;
}

export interface FileInputRef {
  reset: () => void;
}

const FileInput = forwardRef<FileInputRef, FileInputProps>(({ label, onChange, formats }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }));

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-text-primary text-xs sm:text-base whitespace-nowrap">{label}:</span>
      <button
        type="button"
        onClick={handleClick}
        className="px-3 py-2 border border-strong rounded-lg text-text-primary bg-surface-0 hover:bg-surface-hover transition-colors text-sm sm:text-base whitespace-nowrap"
      >
        Choose File
      </button>
      <input
        type="file"
        accept={formats || '.json'}
        onChange={onChange}
        ref={fileInputRef}
        className="hidden"
        aria-label={label}
      />
    </div>
  );
});

FileInput.displayName = 'FileInput';

export default FileInput;