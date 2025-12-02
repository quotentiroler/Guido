import { createPortal } from 'react-dom';
import { ReactNode } from 'react';

interface PortalProps {
  children: ReactNode;
}

/**
 * Portal component that renders children at the document body level.
 * This ensures modals and overlays are not affected by parent CSS transforms,
 * filters, or backdrop-filters which can break fixed positioning.
 */
const Portal: React.FC<PortalProps> = ({ children }) => {
  return createPortal(children, document.body);
};

export default Portal;
