import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User } from 'lucide-react';

export default function Chat({ messages, onSendMessage, isLoading }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Campus</h1>
        <p>Ask questions based on your uploaded sources.</p>
      </div>

      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <Bot size={48} className="welcome-icon" />
            <h2>Welcome to Campus!</h2>
            <p>Upload some sources in the sidebar and start asking questions.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-content">
                {msg.role === 'model' ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message-bubble model">
            <div className="message-avatar">
              <Bot size={20} />
            </div>
            <div className="message-content loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your sources..."
          disabled={isLoading}
        />
        <button type="submit" disabled={!input.trim() || isLoading}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
