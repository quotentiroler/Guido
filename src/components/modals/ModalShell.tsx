import React from "react";
import Portal from "@/components/shared/Portal";

interface ModalShellProps {
  panelClassName: string;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({ panelClassName, children }) => (
  <Portal>
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className={panelClassName}>{children}</div>
    </div>
  </Portal>
);

export default ModalShell;
