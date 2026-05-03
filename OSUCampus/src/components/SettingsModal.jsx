import { useState, useEffect } from 'react';
import { Key, X, LogOut } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  currentKey,
  userEmail,
  onSignOut,
}) {
  const [apiKey, setApiKey] = useState(currentKey || '');

  useEffect(() => {
    queueMicrotask(() => {
      setApiKey(currentKey || '');
    });
  }, [currentKey]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(apiKey);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <Key className="modal-icon" size={24} />
          <h2>API Settings</h2>
        </div>

        {userEmail && (
          <p className="modal-desc settings-account">
            Signed in as <strong>{userEmail}</strong>
          </p>
        )}

        <p className="modal-desc">
          Enter your Gemini API Key to use this study agent. Your key is stored locally in your browser (per account) and is sent only to Google&apos;s API.
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

        {onSignOut && (
          <div className="settings-signout-wrap">
            <button type="button" className="settings-signout-btn" onClick={onSignOut}>
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
