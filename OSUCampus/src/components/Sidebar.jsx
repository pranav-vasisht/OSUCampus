import { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Video, Film, Music, FileType, Link, Loader2, Image, FolderOpen } from 'lucide-react';
import { isTextFile } from '../lib/gemini';

const SUPPORTED_EXTENSIONS = new Set([
  'txt','md','csv','json','pdf','mp4','webm','mov',
  'mp3','wav','ogg','m4a','jpg','jpeg','png','gif','webp'
]);

function isSupportedFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function getDocIcon(doc) {
  if (doc.sourceType === 'youtube') return <Video size={16} />;
  const ext = doc.name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'mp4': case 'webm': case 'mov': return <Film size={16} />;
    case 'mp3': case 'wav': case 'ogg': case 'm4a': return <Music size={16} />;
    case 'pdf': return <FileType size={16} />;
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return <Image size={16} />;
    default: return <FileText size={16} />;
  }
}

function getTypeBadge(doc) {
  if (doc.sourceType === 'youtube') return 'YouTube';
  const ext = doc.name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'mp4': case 'webm': case 'mov': return 'Video';
    case 'mp3': case 'wav': case 'ogg': case 'm4a': return 'Audio';
    case 'pdf': return 'PDF';
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return 'Image';
    default: return 'Text';
  }
}

export default function Sidebar({ documents, onPersistSource, onRemoveDocument, hasApiKey }) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files).filter(f => isSupportedFile(f.name));
    if (!files.length) {
      if (e.target.files.length > 0) {
        alert('No supported files found. Supported types: ' + [...SUPPORTED_EXTENSIONS].join(', '));
      }
      return;
    }

    if (!hasApiKey) {
      alert('Please set your Gemini API Key in settings first.');
      return;
    }

    setIsUploading(true);

    for (const file of files) {
      try {
        if (isTextFile(file.name)) {
          const text = await file.text();
          setUploadStatus(`Saving ${file.name}…`);
          await onPersistSource({
            sourceType: 'text',
            name: file.name,
            content: text,
          });
          setUploadStatus(`Added ${file.name}`);
        } else {
          setUploadStatus(`Uploading ${file.name}…`);
          await onPersistSource({
            sourceType: 'file',
            name: file.name,
            file,
          });
          setUploadStatus(`Uploaded ${file.name}`);
        }
      } catch (error) {
        console.warn(`Skipped unreadable file ${file.name}:`, error.message);
        setUploadStatus(`Failed: ${file.name}`);
      }
    }

    setIsUploading(false);
    setTimeout(() => setUploadStatus(''), 3000);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleAddYoutubeLink = async () => {
    const url = youtubeUrl.trim();
    if (!url) return;

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/;
    if (!ytRegex.test(url)) {
      alert('Please enter a valid YouTube URL.');
      return;
    }

    const displayName = url.length > 40 ? url.substring(0, 40) + '...' : url;
    try {
      setUploadStatus('Saving link…');
      await onPersistSource({
        sourceType: 'youtube',
        name: displayName,
        url,
      });
      setUploadStatus('Link added');
      setYoutubeUrl('');
    } catch (e) {
      console.error(e);
      setUploadStatus(`Failed: ${e.message}`);
    }
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleYoutubeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddYoutubeLink();
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Sources</h2>
        <p>Upload documents, media, or YouTube links.</p>
      </div>

      <div className="upload-row">
        <div
          className={`upload-area ${isUploading ? 'uploading' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 size={20} className="upload-icon spinning" />
          ) : (
            <Upload size={20} className="upload-icon" />
          )}
          <span>{isUploading ? 'Processing...' : 'Upload Files'}</span>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept=".txt,.md,.csv,.json,.pdf,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleFileUpload}
          />
        </div>
        <div
          className={`upload-area ${isUploading ? 'uploading' : ''}`}
          onClick={() => !isUploading && folderInputRef.current?.click()}
        >
          <FolderOpen size={20} className="upload-icon" />
          <span>Upload Folder</span>
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: 'none' }}
            webkitdirectory=""
            directory=""
            onChange={handleFileUpload}
          />
        </div>
      </div>
      <small className="upload-hint">.txt .md .csv .pdf .mp4 .mp3 .jpg .png + folders</small>

      {uploadStatus && (
        <div className="upload-status">{uploadStatus}</div>
      )}

      <div className="youtube-input-area">
        <div className="youtube-label">
          <Video size={14} />
          <span>YouTube Link</span>
        </div>
        <div className="youtube-input-row">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyDown={handleYoutubeKeyDown}
            placeholder="https://youtube.com/watch?v=..."
          />
          <button
            onClick={handleAddYoutubeLink}
            disabled={!youtubeUrl.trim()}
            title="Add YouTube link"
          >
            <Link size={16} />
          </button>
        </div>
      </div>

      <div className="document-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No sources added yet.</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="document-item">
              <div className="document-info">
                <span className="doc-icon">{getDocIcon(doc)}</span>
                <span className="doc-name">{doc.name}</span>
                <span className={`type-badge ${getTypeBadge(doc).toLowerCase()}`}>
                  {getTypeBadge(doc)}
                </span>
                {doc.sourceType === 'file' && !doc.geminiFile && (
                  <span className="type-badge pending-gemini" title="Add your Gemini API key in Settings to use this file">
                    Pending key
                  </span>
                )}
              </div>
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDocument(doc.id);
                }}
                title="Remove source"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
