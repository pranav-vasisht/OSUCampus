import ReactMarkdown from 'react-markdown';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function StudyGuide({ content, onBack }) {
  return (
    <div className="output-view">
      <div className="output-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="output-title">
          <BookOpen size={20} />
          <h2>Study Guide</h2>
        </div>
      </div>
      <div className="output-body prose">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
