import React, { useState, useRef, useEffect } from 'react';
import './AIAgentButton.css';

const AIAgentButton = () => {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  
  const containerRef = useRef(null);
  const recognitionRef = useRef(null);
  const originalTextRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError('');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const original = originalTextRef.current;
        const prefix = original && !original.endsWith(' ') ? original + ' ' : original;
        setInputValue(prefix + finalTranscript + interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Microphone access denied');
        } else if (event.error === 'network') {
          setMicError('Network error occurred');
        } else {
          setMicError(`Voice error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

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

  useEffect(() => {
    if (!expanded) {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      setMicError('');
    }
  }, [expanded, isListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      originalTextRef.current = inputValue;
      recognitionRef.current.start();
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
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
          <div className="input-wrapper">
            <input 
              type="text" 
              placeholder="Ask me anything..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            {micError && <span className="mic-error-text">{micError}</span>}
          </div>
          <button 
            type="button" 
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={!recognitionRef.current ? 'Voice input not supported in this browser' : (isListening ? 'Stop listening' : 'Start voice input')}
            disabled={!recognitionRef.current}
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
