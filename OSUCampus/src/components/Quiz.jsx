import React, { useState } from 'react';
import { ArrowLeft, ClipboardList, Check, X, RotateCcw } from 'lucide-react';

export default function Quiz({ data, onBack }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = data?.questions || [];
  const question = questions[currentQ];

  const handleSelect = (index) => {
    if (revealed) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    setRevealed(true);
    setAnswered(prev => prev + 1);
    if (selected === question.correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setAnswered(0);
    setFinished(false);
  };

  if (!questions.length) {
    return (
      <div className="output-view">
        <div className="output-header">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={18} /><span>Back</span>
          </button>
        </div>
        <div className="output-body"><p>No quiz data available.</p></div>
      </div>
    );
  }

  return (
    <div className="output-view">
      <div className="output-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="output-title">
          <ClipboardList size={20} />
          <h2>{data.title || 'Quiz'}</h2>
        </div>
      </div>

      <div className="quiz-container">
        {finished ? (
          <div className="quiz-results">
            <div className="results-circle">
              <span className="results-score">{score}</span>
              <span className="results-total">/ {questions.length}</span>
            </div>
            <h3>Quiz Complete!</h3>
            <p className="results-pct">
              {Math.round((score / questions.length) * 100)}% correct
            </p>
            <button className="primary-btn" onClick={handleRestart}>
              <RotateCcw size={16} />
              Retake Quiz
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="quiz-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${((currentQ) / questions.length) * 100}%` }}
                />
              </div>
              <span className="progress-text">
                {currentQ + 1} of {questions.length}
              </span>
            </div>

            {/* Question */}
            <div className="quiz-question">
              <p>{question.question}</p>
            </div>

            {/* Options */}
            <div className="quiz-options">
              {question.options.map((opt, i) => {
                let className = 'quiz-option';
                if (revealed) {
                  if (i === question.correctIndex) className += ' correct';
                  else if (i === selected) className += ' incorrect';
                } else if (i === selected) {
                  className += ' selected';
                }

                return (
                  <button
                    key={i}
                    className={className}
                    onClick={() => handleSelect(i)}
                    disabled={revealed}
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="option-text">{opt}</span>
                    {revealed && i === question.correctIndex && (
                      <Check size={18} className="option-icon correct" />
                    )}
                    {revealed && i === selected && i !== question.correctIndex && (
                      <X size={18} className="option-icon incorrect" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {revealed && question.explanation && (
              <div className="quiz-explanation">
                <strong>Explanation:</strong> {question.explanation}
              </div>
            )}

            {/* Actions */}
            <div className="quiz-actions">
              {!revealed ? (
                <button
                  className="primary-btn"
                  onClick={handleSubmit}
                  disabled={selected === null}
                >
                  Check Answer
                </button>
              ) : (
                <button className="primary-btn" onClick={handleNext}>
                  {currentQ < questions.length - 1 ? 'Next Question' : 'See Results'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
