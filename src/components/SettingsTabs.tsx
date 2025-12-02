import React from "react";
import FieldsTab from "./FieldsTab";
import RulesTab from "./RulesTab";

const SettingsTabs: React.FC = () => {
  const tabs = ["fieldsTab", "rulesTab"];
  const [activeTab, setActiveTab] = React.useState(tabs[0]); 
  const activeIndex = tabs.indexOf(activeTab);

  const formattedTabName = (name: string) => {
       return name.replace("Tab", "").replace(/^\w/, c => c.toUpperCase());
  }

  return (
    <>
      <div className="relative flex border-b border-strong">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={`flex-1 text-center py-3 px-4 transition-colors duration-200 ${activeTab === tab
              ? "text-secondary-default font-medium"
              : "text-text-secondary hover:text-secondary-default"
              }`}
            onClick={() => setActiveTab(tab)}
          >
            {formattedTabName(tab)}
          </button>
        ))}
        {/* Sliding underline indicator */}
        <div 
          className="absolute bottom-0 h-0.5 bg-secondary-default transition-all duration-300 ease-in-out"
          style={{
            width: `${100 / tabs.length}%`,
            left: `${(activeIndex * 100) / tabs.length}%`
          }}
        />
      </div>

      {activeTab === "fieldsTab" && (
        <FieldsTab />
      )}
      {activeTab === "rulesTab" && (
        <RulesTab />
      )}
    </>
  );
};

export default SettingsTabs;