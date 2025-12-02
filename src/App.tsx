import "@/App.css";
import SettingsForm from "@/components/SettingsForm";
import { useEffect, useState } from "react";
import { marked } from "marked";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarsBackground from "@/components/MarsBackground";
import MarsCliffBackground from "@/components/MarsCliffBackground";
import GuidoEasterEgg from "@/components/GuidoEasterEgg";
import AIChatOverlay from "@/components/AIChatOverlay";
import { useTheme } from "@/hooks/useTheme";
import { useEasterEgg } from "@/hooks/useEasterEgg";
import { useAppContext } from "@/hooks/useAppContext";

function App() {
  const [readmeContent, setReadmeContent] = useState<string>("");
  const { marsBackground, secretSpaceMode } = useTheme();
  const { isActive: easterEggActive, setIsActive: setEasterEggActive, hideUI } = useEasterEgg();
  const { isExpertMode } = useAppContext();

  useEffect(() => {
    const fetchReadme = async () => {
      try {
        let response;
        if (isExpertMode) response = await fetch("/Guido/HELP.md");
        else response = await fetch("/Guido/HELP.simple.md");
        const text = await response.text();
        const html = await marked(text);
        setReadmeContent(html);
      } catch (error) {
        console.error("Error fetching README.md:", error);
      }
    };
    void fetchReadme();
  }, [isExpertMode]);

  return (
    <div className="min-h-screen flex flex-col text-text-primary transition-colors relative">
      {/* Secret cliff background (Guido's chill spot) - takes priority */}
      {secretSpaceMode && <MarsCliffBackground />}
      
      {/* Mars surface background with animated sun/moon - when not in secret mode */}
      {!secretSpaceMode && <MarsBackground />}
      
      {/* Fallback solid background when Mars is disabled and not in secret mode */}
      {!marsBackground && !secretSpaceMode && (
        <div 
          className="fixed inset-0 bg-surface-0 transition-colors duration-300"
          style={{ zIndex: -1 }}
        />
      )}
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Hide Header and Form during easter egg animation for immersive experience */}
        {!hideUI && (
          <>
            <Header readmeContent={readmeContent} />
            <div className="flex-grow max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <SettingsForm />
            </div>
          </>
        )}
        <Footer />
      </div>
      
      {/* Easter Egg Animation */}
      <GuidoEasterEgg 
        isActive={easterEggActive} 
        onComplete={() => setEasterEggActive(false)} 
      />
      
      {/* AI Chat Overlay */}
      <AIChatOverlay />
    </div>
  );
}

export default App;