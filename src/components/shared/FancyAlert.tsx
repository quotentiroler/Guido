import React, { useMemo } from 'react';
import { Interweave } from 'interweave';
import Button from "./Button";

interface FancyAlertProps {
  message: string;
  onClose: () => void;
}

/**
 * Remove whitespace between table-related HTML tags to prevent React hydration warnings.
 * HTML tables cannot have text nodes (including whitespace) as direct children.
 */
function sanitizeTableWhitespace(html: string): string {
  // Remove whitespace between table-related closing and opening tags
  return html
    .replace(/(<table[^>]*>)\s+/g, '$1')
    .replace(/\s+(<\/table>)/g, '$1')
    .replace(/(<thead[^>]*>)\s+/g, '$1')
    .replace(/\s+(<\/thead>)/g, '$1')
    .replace(/(<tbody[^>]*>)\s+/g, '$1')
    .replace(/\s+(<\/tbody>)/g, '$1')
    .replace(/(<tr[^>]*>)\s+/g, '$1')
    .replace(/\s+(<\/tr>)/g, '$1')
    .replace(/<\/th>\s+<th/g, '</th><th')
    .replace(/<\/td>\s+<td/g, '</td><td')
    .replace(/<\/tr>\s+<tr/g, '</tr><tr')
    .replace(/<\/thead>\s+<tbody/g, '</thead><tbody');
}

const FancyAlert: React.FC<FancyAlertProps> = ({ message, onClose }) => {
  const sanitizedMessage = useMemo(() => sanitizeTableWhitespace(message), [message]);
  
  // Use narrower width for short messages, wider for complex content (tables, long text)
  const isComplexContent = message.includes('<table') || message.includes('<ul') || message.length > 200;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/50 overflow-y-auto p-4 sm:p-6 z-50"
      onClick={onClose}
    >
      <div 
        className={`bg-surface-0 p-4 sm:p-6 rounded-lg shadow-lg mx-auto my-auto ${
          isComplexContent 
            ? 'w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl' 
            : 'w-auto max-w-sm'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3 sm:mb-4">
          <img src="/Guido/guido_icon.png" alt="Guido" className="h-10 sm:h-12 opacity-90" />
        </div>
        <div className="markdown-content mb-3 sm:mb-4 max-h-[60vh] overflow-y-auto overflow-x-auto text-text-primary text-sm sm:text-base text-center">
          <Interweave content={sanitizedMessage} />
        </div>
        <div className="flex justify-center">
          <Button onClick={onClose} size="small">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FancyAlert;