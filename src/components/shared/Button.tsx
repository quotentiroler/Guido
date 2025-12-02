import React, { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';

interface ButtonProps {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  type?: ButtonType;
  title?: string;
}

type ButtonType = "primary" | "primary-text" | "secondary" | "secondary-text" | "error-text";

// Calculate relative luminance of a color (WCAG formula)
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Parse color string to RGB values
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  // Handle hex
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
  }
  return null;
}

// Determine if text should be dark or light based on background luminance
const LUMINANCE_THRESHOLD = 0.40;

function shouldUseDarkText(bgColor: string): boolean {
  const rgb = parseColor(bgColor);
  if (!rgb) return true; // Default to dark text if parsing fails
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > LUMINANCE_THRESHOLD;
}

const Button: React.FC<ButtonProps> = ({ onClick, className, children, size = "medium", type = "primary", title }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [useDarkText, setUseDarkText] = useState<boolean>(true);

  // Background color classes - using theme-aware colors
  const bgClassNames = (type: ButtonType) => {
    switch (type) {
      case "secondary-text":
        return "bg-btn-secondary-light";
      case "secondary":
        return "bg-secondary-default";
      case "error-text":
        return "bg-btn-error-light";
      case "primary-text":
        return "bg-btn-primary-light";
      case "primary":
        return "bg-primary-default";
    }
  };

  useEffect(() => {
    const calculateContrast = () => {
      if (!buttonRef.current) return;
      const computedStyle = getComputedStyle(buttonRef.current);
      const bgColor = computedStyle.backgroundColor;
      setUseDarkText(shouldUseDarkText(bgColor));
    };

    // Initial calculation with delay to ensure styles are applied
    const timer = setTimeout(calculateContrast, 50);

    return () => clearTimeout(timer);
  }, [type]);

  // Re-calculate on theme changes by observing class changes on root
  useEffect(() => {
    const calculateContrast = () => {
      if (!buttonRef.current) return;
      // Use requestAnimationFrame to ensure CSS has updated
      requestAnimationFrame(() => {
        if (!buttonRef.current) return;
        const computedStyle = getComputedStyle(buttonRef.current);
        const bgColor = computedStyle.backgroundColor;
        setUseDarkText(shouldUseDarkText(bgColor));
      });
    };

    const observer = new MutationObserver(() => {
      // Double RAF to ensure CSS variables have propagated
      requestAnimationFrame(() => {
        requestAnimationFrame(calculateContrast);
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, []);

  const textColorClass = useDarkText ? "text-gray-900" : "text-white";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      title={title}
      className={classNames(
        bgClassNames(type),
        textColorClass,
        `${size === "small" ? "px-4 py-2" : (size === "medium" ? "px-6 py-3" : "px-7 py-4")}`,
        "rounded-default hover:opacity-70 transition-opacity duration-200 text-base font-medium",
        className
      )}
    >
      {children}
    </button>
  );
};

export default Button;