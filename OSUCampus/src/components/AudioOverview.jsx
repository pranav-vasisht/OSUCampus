import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Headphones, Play, Pause, Square } from 'lucide-react';

export default function AudioOverview({ content, onBack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(-1);
  const utteranceRef = useRef(null);
  const linesRef = useRef([]);

  // Parse lines for TTS
  useEffect(() => {
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    linesRef.current = lines;
  }, [content]);

  const speak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Your browser does not support text-to-speech.');
      return;
    }

    window.speechSynthesis.cancel();

    // Clean the script for TTS: remove markdown formatting
    const cleanText = content
      .replace(/\*\*Alex:\*\*/g, '... Alex says: ')
      .replace(/\*\*Sam:\*\*/g, '... Sam says: ')
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Natural'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentLine(-1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!window.speechSynthesis) return;

    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    } else {
      speak();
    }
  };

  const stop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setCurrentLine(-1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="output-view">
      <div className="output-header">
        <button className="back-btn" onClick={() => { stop(); onBack(); }}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="output-title">
          <Headphones size={20} />
          <h2>Audio Overview</h2>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="audio-controls">
        <div className="audio-visualizer">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`bar ${isPlaying ? 'active' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        <div className="audio-buttons">
          <button
            className="audio-btn primary"
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className="audio-btn" onClick={stop} title="Stop">
            <Square size={18} />
          </button>
        </div>
        <p className="audio-hint">Uses browser text-to-speech</p>
      </div>

      {/* Script Transcript */}
      <div className="output-body prose">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
