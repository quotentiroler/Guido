import { TemplateContext, TemplateContextProps } from "@/context/TemplateContext";
import { useContext } from "react";

export const useTemplateContext = (): TemplateContextProps => {
    const context = useContext(TemplateContext);
    if (!context) {
      throw new Error('useTemplateContext must be used within a TemplateProvider');
    }
    return context;
  };