import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

const API_BASE = 'http://localhost:3000';
const WS_BASE = 'ws://localhost:3000/ws';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  
  // App State
  const [jobs, setJobs] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Modal State
  const [modalJob, setModalJob] = useState(null);
  
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auth flow (Auto)
  useEffect(() => {
    if (!token && !isLoading) {
      const autoLogin = async () => {
        setIsLoading(true);
        try {
          const generatedId = 'user_' + Math.random().toString(36).substr(2, 9);
          const currentUserId = localStorage.getItem('userId') || generatedId;
          
          const res = await fetch(`${API_BASE}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
          });
          
          if (!res.ok) throw new Error('Login failed');
          
          const data = await res.json();
          setToken(data.accessToken);
          setUserId(data.userId);
          localStorage.setItem('token', data.accessToken);
          localStorage.setItem('userId', data.userId);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      autoLogin();
    }
  }, [token]);

  const handleLogout = useCallback(() => {
    setToken('');
    setUserId('');
    setJobs([]);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    if (wsRef.current) {
      wsRef.current.close();
    }
    window.location.reload();
  }, []);

  // Idle Timeout (10 minutes)
  useEffect(() => {
    if (!token) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('User idle for 10 minutes, logging out');
        handleLogout();
      }, 10 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [token, handleLogout]);

  // REST API: Fetch Jobs
  const fetchJobs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    }
  };

  // Drag and Drop Handlers
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      alert('Please select an image file.');
    }
  };

  // REST API: Create Job with Image
  const createJob = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile || !token) return;
    
    setIsLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('title', selectedFile.name); // Using filename as title

      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: formData
      });
      
      if (res.ok) {
        const newJob = await res.json();
        
        // Auto-queue the job after creation to trigger worker
        const queueRes = await fetch(`${API_BASE}/jobs/${newJob.id}/status`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ status: 'QUEUED' })
        });
        
        const queuedJob = queueRes.ok ? await queueRes.json() : newJob;
        
        setJobs(prev => [queuedJob, ...prev]);
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to create job'}`);
      }
    } catch (err) {
      console.error('Failed to create job', err);
      alert('Network error while uploading image');
    } finally {
      setIsLoading(false);
    }
  };

  // REST API: Delete Job
  const deleteJob = async (id) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(prev => prev.filter(job => job.id !== id));
    } catch (err) {
      console.error('Failed to delete job', err);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    if (token) {
      fetchJobs();
    }
  }, [token]);

  // WebSocket Connection
  useEffect(() => {
    if (!token) return;

    let reconnectTimer;
    
    const connectWs = () => {
      setWsStatus('connecting');
      const ws = new WebSocket(`${WS_BASE}?token=${token}`);
      
      ws.onopen = () => {
        setWsStatus('connected');
        console.log('WS connected');
        fetchJobs();
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WS Event:', data);
          
          if (data.type === 'job_updated') {
            setJobs(prevJobs => {
              const updatedJob = { ...data.job };
              if (data.event && data.event.message) {
                updatedJob.currentMessage = data.event.message;
              }
              
              const jobIndex = prevJobs.findIndex(j => j.id === updatedJob.id);
              if (jobIndex > -1) {
                const newJobs = [...prevJobs];
                newJobs[jobIndex] = { ...newJobs[jobIndex], ...updatedJob };
                return newJobs;
              } else {
                return [updatedJob, ...prevJobs];
              }
            });
          }
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };
      
      ws.onclose = (event) => {
        setWsStatus('disconnected');
        console.log('WS disconnected', event.code);
        if (event.code !== 4001) {
           reconnectTimer = setTimeout(connectWs, 3000);
        } else {
           handleLogout();
        }
      };
      
      ws.onerror = (err) => {
        console.error('WS error', err);
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connectWs();
    
    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  // Fallback Polling if WS is disconnected
  useEffect(() => {
    if (!token || wsStatus === 'connected') return;
    
    const intervalId = setInterval(() => {
      fetchJobs();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [token, wsStatus]);

  // --- Render ---
  
  if (!token) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
          <h2>Initializing Session...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="nav-bar">
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>
            Service Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Session ID: <strong>{userId}</strong>
          </p>
        </div>
        <button onClick={handleLogout} className="btn logout-btn">Reset Session</button>
      </div>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div 
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${previewUrl ? 'has-preview' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleFileSelection(e.target.files[0])}
            style={{ display: 'none' }}
            accept="image/*"
          />
          
          {previewUrl ? (
            <div className="preview-container">
              <img src={previewUrl} alt="Preview" className="image-preview" />
              <div className="preview-overlay">
                <p>Click or drag to change image</p>
              </div>
            </div>
          ) : (
            <div className="drop-content">
              <div className="upload-icon">📸</div>
              <p>Drag & Drop a file here or click to browse</p>
              <span className="hint">Upload a file to process its content</span>
            </div>
          )}
        </div>
        
        {selectedFile && (
          <div className="upload-actions">
            <button onClick={createJob} className="btn generate-btn" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Upload & Process'}
            </button>
            <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="btn-secondary" disabled={isLoading}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="jobs-grid">
        {jobs.map(job => (
          <div key={job.id} className="job-card">
            <div className="job-header">
              <span className="job-id">#{String(job.id).substring(0, 8)}</span>
              <div className={`job-status status-${job.status ? job.status.toLowerCase() : 'unknown'}`}>
                {(job.status === 'QUEUED' || job.status === 'PROCESSING') && <div className="spinner"></div>}
                <span>{job.status}</span>
              </div>
            </div>
            
            <div className="job-image-preview" onClick={() => job.imagePath && setModalJob(job)}>
              {job.imagePath ? (
                <>
                  <img src={`${API_BASE}/data/${job.imagePath}`} alt="Job" />
                  <div className="zoom-overlay">
                    <span className="zoom-icon">🔍</span>
                  </div>
                </>
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>

            <p className="job-title">{job.title}</p>
            
            {job.currentMessage && job.status !== 'DONE' && job.status !== 'ERROR' && (
              <p className="progress-message">{job.currentMessage}...</p>
            )}
            
            {job.status === 'DONE' && job.downloadUrl && (
              <div className="result-area">
                <p className="result-label">Result:</p>
                <div className="result-text">
                  <ResultContent url={job.downloadUrl} token={token} />
                </div>
              </div>
            )}

            {job.status === 'ERROR' && (
              <p className="error-text">Error: {job.error}</p>
            )}
            
            <div className="job-footer">
              <span className="job-date">
                {new Date(job.createdAt).toLocaleString()}
              </span>
              
              <button 
                onClick={() => deleteJob(job.id)}
                className="delete-btn"
                title="Delete Job"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {jobs.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            <p>No generation jobs yet.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>
              If you just uploaded, please wait a moment for the AI to process your image.
            </p>
          </div>
        )}
      </div>

      <div className={`ws-status ws-${wsStatus}`}>
        <div className="ws-dot"></div>
        {wsStatus === 'connected' ? 'Real-time Active' : 
         wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected (REST Fallback)'}
      </div>

      {modalJob && (
        <div className="modal-overlay" onClick={() => setModalJob(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalJob(null)}>×</button>
            <div className="modal-image-container">
              <img src={`${API_BASE}/data/${modalJob.imagePath}`} alt="Full size" className="modal-image" />
            </div>
            {modalJob.status === 'DONE' && modalJob.downloadUrl && (
              <div className="modal-prompt">
                <p className="result-label">Result:</p>
                <div className="result-text">
                  <ResultContent url={modalJob.downloadUrl} token={token} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component to fetch and display the text result from MinIO
function ResultContent({ url, token }) {
  const [content, setContent] = useState('Loading...');
  
  useEffect(() => {
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.text())
      .then(text => setContent(text))
      .catch(err => setContent('Failed to load result'));
  }, [url, token]);
  
  return content;
}

export default App;
