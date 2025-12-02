import React from "react";
import { Interweave } from "interweave";
import Button from "./shared/Button";
import Portal from "./shared/Portal";
import { useAI } from "@/hooks/useAI";
import { ChatHistoryItem } from "@/context/AIContext";

interface ChatHistoryModalProps {
  onClose: () => void;
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ChatHistoryItemCard: React.FC<{ item: ChatHistoryItem }> = ({ item }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isLongResponse = item.assistantResponse.length > 200;
  
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 space-y-3">
      {/* Timestamp */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{formatDate(item.timestamp)}</span>
        {item.toolsUsed && item.toolsUsed.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-tertiary">🔧</span>
            <span className="text-xs text-primary-500">{item.toolsUsed.length} tool{item.toolsUsed.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      
      {/* User message */}
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">👤</span>
        <p className="text-sm text-text-primary">{item.userMessage}</p>
      </div>
      
      {/* Assistant response */}
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">🤖</span>
        <div className="flex-1 min-w-0">
          <div className={`markdown-content text-sm text-text-secondary ${!isExpanded && isLongResponse ? 'line-clamp-3' : ''}`}>
            <Interweave content={item.assistantResponse} />
          </div>
          {isLongResponse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs text-primary-500 hover:text-primary-600"
            >
              {isExpanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      </div>
      
      {/* Tools used badges */}
      {item.toolsUsed && item.toolsUsed.length > 0 && isExpanded && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
          {item.toolsUsed.map((tool, idx) => (
            <span 
              key={idx}
              className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full"
            >
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ onClose }) => {
  const { chatHistory, clearChatHistory } = useAI();
  const [showConfirmClear, setShowConfirmClear] = React.useState(false);

  const handleClearHistory = () => {
    clearChatHistory();
    setShowConfirmClear(false);
  };

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-surface-0 p-6 rounded-default shadow-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col mx-4 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <span className="text-2xl">💬</span> Chat History
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          
          <p className="text-sm text-text-secondary mb-4">
            Your recent conversations with Guido AI. History is stored locally in your browser.
          </p>

          {/* History list */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                <span className="text-4xl mb-3">🤖</span>
                <p className="text-center">No chat history yet.</p>
                <p className="text-sm text-center mt-1">Start a conversation with Guido by clicking on the mascot!</p>
              </div>
            ) : (
              chatHistory.map((item) => (
                <ChatHistoryItemCard key={item.id} item={item} />
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <div>
              {chatHistory.length > 0 && !showConfirmClear && (
                <Button onClick={() => setShowConfirmClear(true)} type="error-text">
                  Clear History
                </Button>
              )}
              {showConfirmClear && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-error-600">Are you sure?</span>
                  <Button onClick={handleClearHistory} type="error-text">
                    Yes, Clear
                  </Button>
                  <Button onClick={() => setShowConfirmClear(false)} type="secondary-text">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <Button onClick={onClose} type="primary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ChatHistoryModal;
