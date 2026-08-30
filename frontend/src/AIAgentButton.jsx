import React, { useState, useRef, useEffect } from 'react';
import './AIAgentButton.css';

const AIAgentButton = ({ onSearchResult, onClear }) => {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef(null);
  const recognitionRef = useRef(null);
  const originalTextRef = useRef('');
  const isAbortingRef = useRef(false);

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
        isAbortingRef.current = false;
      };

      recognition.onresult = (event) => {
        if (isAbortingRef.current) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
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
        } else if (event.error !== 'aborted') {
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

  const handleClose = () => {
    if (isListening && recognitionRef.current) {
      isAbortingRef.current = true;
      recognitionRef.current.stop();
      setIsListening(false);
      setInputValue(originalTextRef.current);
    }
    setExpanded(false);
    if (onClear) onClear();
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      originalTextRef.current = inputValue;
      isAbortingRef.current = false;
      recognitionRef.current.start();
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    
    const message = inputValue.trim();
    if (!message) return;

    if (isListening && recognitionRef.current) {
      isAbortingRef.current = true;
      recognitionRef.current.stop();
      setIsListening(false);
    }
    originalTextRef.current = '';
    
    setInputValue('');
    setIsLoading(true);
    setStatusMsg('Thinking...');
    if (onClear) onClear();
    
    try {
      const res = await fetch('http://localhost:3000/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      
      if (data.error) {
        setStatusMsg('Error: ' + data.error);
      } else {
        setStatusMsg(data.message || 'Done.');
        if (onSearchResult) onSearchResult(data);
      }
    } catch (err) {
      setStatusMsg('Failed to connect to AI service.');
    } finally {
      setIsLoading(false);
    }
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
            {statusMsg && (
              <div className="ai-status-message" style={{
                whiteSpace: 'normal',
                top: 'auto',
                bottom: '100%',
                marginBottom: '10px',
                left: 0,
                width: '100%',
                pointerEvents: 'auto',
                boxSizing: 'border-box',
                lineHeight: '1.4'
              }}>
                {statusMsg}
              </div>
            )}
            <input 
              type="text" 
              placeholder="Ask me anything..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              disabled={isLoading}
            />
            {micError && <span className="mic-error-text">{micError}</span>}
          </div>
          <button 
            type="button" 
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={!recognitionRef.current ? 'Voice input not supported in this browser' : (isListening ? 'Stop listening' : 'Start voice input')}
            disabled={!recognitionRef.current || isLoading}
          >
            🎤
          </button>
          <button type="submit" className="send-btn" title="Send" disabled={isLoading}>
            ➤
          </button>
          <button type="button" className="close-btn" onClick={handleClose} title="Close">
            ✖
          </button>
        </form>
      )}
    </div>
  );
}

export default AIAgentButton;
