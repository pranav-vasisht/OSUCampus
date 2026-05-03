import React, { useState } from 'react';
import { Key, X } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSave, currentKey }) {
  const [apiKey, setApiKey] = useState(currentKey || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(apiKey);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="modal-header">
          <Key className="modal-icon" size={24} />
          <h2>API Settings</h2>
        </div>
        
        <p className="modal-desc">
          Enter your Gemini API Key to use this study agent. Your key is stored locally in your browser and is never sent anywhere except directly to Google's API.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">Gemini API Key</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              required
            />
          </div>
          <button type="submit" className="primary-btn">Save Key</button>
        </form>
      </div>
    </div>
  );
}
