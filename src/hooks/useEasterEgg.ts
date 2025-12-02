import { useContext } from "react";
import { EasterEggContext, EasterEggContextType } from "@/context/EasterEggContext";

export const useEasterEgg = (): EasterEggContextType => {
  const context = useContext(EasterEggContext);
  if (context === undefined) {
    throw new Error("useEasterEgg must be used within an EasterEggProvider");
  }
  return context;
};
