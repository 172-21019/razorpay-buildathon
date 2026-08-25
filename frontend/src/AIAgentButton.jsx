import React, { useState, useRef, useEffect } from 'react';
import './AIAgentButton.css';

const AIAgentButton = () => {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (expanded && containerRef.current && !containerRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  const handleSend = (e) => {
    e.preventDefault();
    // This is a pure visual shell for now. No-op execution.
    setInputValue('');
  };

  return (
    <div className={`ai-agent-container ${expanded ? 'expanded' : ''}`} ref={containerRef}>
      {!expanded ? (
        <button className="ai-trigger-btn" onClick={() => setExpanded(true)} aria-label="Open AI Assistant">
          <span className="ai-icon">✨</span>
        </button>
      ) : (
        <form className="ai-capsule" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Ask me anything..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
          <button 
            type="button" 
            className="mic-btn" 
            onClick={() => { /* TODO: wire up speech-to-text later */ }} 
            title="Voice input (coming soon)"
          >
            🎤
          </button>
          <button type="submit" className="send-btn" title="Send">
            ➤
          </button>
          <button type="button" className="close-btn" onClick={() => setExpanded(false)} title="Close">
            ✖
          </button>
        </form>
      )}
    </div>
  );
};

export default AIAgentButton;
