import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

function App() {
  const [ipAddress, setIpAddress] = useState('192.168.1.103');
  const [isConnected, setIsConnected] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(''); // Realtime status
  
  // New State variables
  const [resolution, setResolution] = useState(5);
  const [cropType, setCropType] = useState('Unknown');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  
  const [analysisResult, setAnalysisResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const reportRef = useRef(null);

  const handleConnect = (e) => {
    e.preventDefault();
    if (ipAddress.trim()) setIsConnected(true);
  };

  const changeResolution = async (e) => {
    const resValue = e.target.value;
    setResolution(resValue);
    if (!isConnected) return;
    try {
      await fetch(`http://${ipAddress}/resolution?val=${resValue}`);
      setTimeout(() => {
        const img = document.getElementById("stream-img");
        if (img) img.src = `http://${ipAddress}/stream?t=${new Date().getTime()}`;
      }, 500);
    } catch (error) {
      console.error('Failed to change resolution:', error);
    }
  };

  const updateCameraControl = async (control, value) => {
    if (!isConnected) return;
    try {
      await fetch(`http://${ipAddress}/control?var=${control}&val=${value}`);
    } catch (error) {
      console.error(`Failed to change ${control}:`, error);
    }
  };

  const toggleFlash = async () => {
    if (!isConnected) return;
    try {
      const response = await fetch(`http://${ipAddress}/flash`);
      const text = await response.text();
      setIsFlashOn(text === 'ON');
    } catch (error) {
      console.error('Failed to toggle flash:', error);
    }
  };

  const captureImage = async () => {
    if (!isConnected) return;
    setLoadingStatus('Capturing instant snapshot...');
    setAnalysisResult(null);
    setCapturedImage(null);
    setChatHistory([]);

    try {
      // 🚀 HUGE SPEED UP: Grab the frame directly from the HTML img element!
      // This completely skips the ESP32 software JPEG encoding delay!
      const img = document.getElementById("stream-img");
      if (!img) throw new Error("Stream not found");

      const canvas = document.createElement("canvas");
      // Use the actual intrinsic size of the stream image
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Get base64 string instantly!
      const base64Data = canvas.toDataURL("image/jpeg", 0.95);
      
      setCapturedImage(base64Data);
      setLoadingStatus('');
      
    } catch (error) {
      console.error('Capture failed:', error);
      alert('Capture failed. Please try again.');
      setLoadingStatus('');
    }
  };

  const analyzeImage = async () => {
    if (!capturedImage) return;
    setIsAnalyzing(true);
    setLoadingStatus('Sending to  AI for Analysis...');

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: capturedImage, cropType })
      });
      
      if (!response.ok) {
        throw new Error("Backend analysis failed");
      }
      
      setLoadingStatus('Parsing AI Diagnosis...');
      const result = await response.json();
      
      setAnalysisResult({
        crop: cropType,
        disease: result.disease,
        confidence: result.confidence,
        symptoms: result.symptoms,
        treatment: result.treatment
      });
      
      setChatHistory([
        { sender: 'ai', text: `I have diagnosed your ${cropType} with ${result.disease}. How else can I help?` }
      ]);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Is the Node.js backend running?');
    } finally {
      setIsAnalyzing(false);
      setLoadingStatus('');
    }
  };

  const downloadReport = () => {
    if (!reportRef.current) return;
    try {
      const opt = {
        margin:       1,
        filename:     'Plant_Diagnosis_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().from(reportRef.current).set(opt).save().catch(err => {
        console.error('PDF Error:', err);
        alert('Failed to generate PDF. You can press Ctrl+P to print/save as PDF instead.');
      });
    } catch (error) {
      console.error('html2pdf setup error:', error);
      alert('PDF library failed to load. Please press Ctrl+P to print/save as PDF instead.');
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if(!chatMessage.trim()) return;
    
    // Add user msg
    const newHistory = [...chatHistory, { sender: 'user', text: chatMessage }];
    setChatHistory(newHistory);
    const messageToSend = chatMessage;
    setChatMessage('');
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageToSend, 
          contextDisease: analysisResult?.disease,
          cropType: cropType
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatHistory([...newHistory, { sender: 'ai', text: data.reply }]);
      }
    } catch (error) {
      setChatHistory([...newHistory, { sender: 'ai', text: "Sorry, I couldn't connect to the backend server." }]);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Plant AI Diagnostician</h1>
        <p>Live ESP32-CAM Analysis powered by Gemini Multimodal Vision</p>
      </header>

      <main className="dashboard">
        {/* Left Column: Camera Controls & Stream */}
        <section className="card">
          <h2>📸 Camera Feed</h2>
          
          <div className="video-container">
            {isConnected ? (
              <img id="stream-img" src={`http://${ipAddress}/stream`} alt="Live Feed" crossOrigin="anonymous"/>
            ) : (
              <div className="placeholder-text">Enter your ESP32-CAM IP Address.</div>
            )}
          </div>

          <div className="controls">
            <form onSubmit={handleConnect} className="input-group">
              <input type="text" placeholder="192.168.1.xxx" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
              <button type="submit" className="btn btn-secondary">{isConnected ? 'Update' : 'Connect'}</button>
            </form>

            {isConnected && (
              <>
                <div className="control-panel">
                  <div className="control-row">
                    <label>Crop Type:</label>
                    <select value={cropType} onChange={(e) => setCropType(e.target.value)}>
                      <option value="Unknown">Select Crop (Optional)</option>
                      <option value="Tomato">Tomato</option>
                      <option value="Potato">Potato</option>
                      <option value="Apple">Apple</option>
                      <option value="Grape">Grape</option>
                      <option value="Corn">Corn</option>
                    </select>
                  </div>
                  
                  <div className="control-row">
                    <label>Resolution:</label>
                    <select value={resolution} onChange={changeResolution}>
                      <option value={4}>160x120 (QQVGA)</option>
                      <option value={5}>320x240 (QVGA)</option>
                      <option value={6}>400x296 (CIF)</option>
                      <option value={7}>480x320 (HVGA)</option>
                      <option value={8}>640x480 (VGA)</option>
                      <option value={9}>800x600 (SVGA)</option>
                    </select>
                  </div>
                  
                  <div className="slider-group">
                    <label>Brightness ({brightness})</label>
                    <input type="range" min="-2" max="2" value={brightness} onChange={(e) => {
                      setBrightness(e.target.value);
                      updateCameraControl('brightness', e.target.value);
                    }} />
                  </div>
                  <div className="slider-group">
                    <label>Contrast ({contrast})</label>
                    <input type="range" min="-2" max="2" value={contrast} onChange={(e) => {
                      setContrast(e.target.value);
                      updateCameraControl('contrast', e.target.value);
                    }} />
                  </div>
                  <div className="slider-group">
                    <label>Saturation ({saturation})</label>
                    <input type="range" min="-2" max="2" value={saturation} onChange={(e) => {
                      setSaturation(e.target.value);
                      updateCameraControl('saturation', e.target.value);
                    }} />
                  </div>
                </div>
              </>
            )}
            
            <div className="input-group" style={{marginTop: '0.5rem'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={toggleFlash} disabled={!isConnected}>
                🔦 Flash
              </button>
              
              <button className="btn btn-primary" style={{flex: 2}} onClick={captureImage} disabled={!isConnected || loadingStatus !== ''}>
                {loadingStatus === 'Capturing high-res snapshot...' ? <><div className="loader"></div> Capturing...</> : '📸 Capture Image'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: AI Results & Chat */}
        <section className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2 style={{margin: 0}}>🧬 Diagnostic Report</h2>
            {analysisResult && (
              <button onClick={downloadReport} className="btn btn-secondary" style={{padding: '0.5rem 1rem', fontSize: '0.85rem'}}>
                📥 Download PDF
              </button>
            )}
          </div>
          
          {!capturedImage && !isAnalyzing && loadingStatus === '' && (
            <div className="placeholder-text" style={{marginTop: '3rem'}}>
              Position a leaf clearly and click "Capture Image".
            </div>
          )}

          {loadingStatus !== '' && !isAnalyzing && (
            <div className="placeholder-text" style={{marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
              <div className="loader" style={{width: '40px', height: '40px', borderWidth: '4px'}}></div>
              <p style={{fontWeight: 500, color: 'var(--primary)'}}>{loadingStatus}</p>
            </div>
          )}
          
          {/* Show the captured image and the Analyze button BEFORE analysis */}
          {capturedImage && !analysisResult && !isAnalyzing && (
            <div style={{padding: '1rem', background: 'var(--card-bg)', borderRadius: '1rem', textAlign: 'center'}}>
               <h3 style={{marginBottom: '1rem'}}>Captured Snapshot</h3>
               <div style={{marginBottom: '1rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)'}}>
                 <img src={capturedImage} alt="Captured Leaf" style={{width: '100%', display: 'block'}} />
               </div>
               <button className="btn btn-primary" style={{width: '100%'}} onClick={analyzeImage}>
                 ✨ Analyze with  AI
               </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="placeholder-text" style={{marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
              <div className="loader" style={{width: '40px', height: '40px', borderWidth: '4px'}}></div>
              <p style={{fontWeight: 500, color: 'var(--primary)'}}>{loadingStatus}</p>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <>
              {/* This div is what gets converted to PDF */}
              <div ref={reportRef} style={{padding: '1rem', background: 'var(--card-bg)', borderRadius: '1rem', color: 'var(--text-main)'}}>
                <div style={{textAlign: 'center', marginBottom: '1rem', display: 'none'}} className="pdf-header">
                  <h2>Plant Diagnosis Report</h2>
                  <p>{new Date().toLocaleDateString()}</p>
                </div>

                {capturedImage && (
                  <div style={{marginBottom: '1rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)'}}>
                    <img src={capturedImage} alt="Captured Leaf" style={{width: '100%', display: 'block'}} />
                  </div>
                )}
                
                <div className="analysis-results">
                  <div className="result-item" style={{background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)'}}>
                    <div className="result-label">Detected Condition</div>
                    <div className="result-value disease-name">{analysisResult.disease}</div>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="result-item">
                      <div className="result-label">Crop</div>
                      <div className="result-value">{analysisResult.crop}</div>
                    </div>
                    <div className="result-item">
                      <div className="result-label">Confidence</div>
                      <div className="result-value">{analysisResult.confidence}</div>
                    </div>
                  </div>
                  
                  <div className="result-item">
                    <div className="result-label">Symptoms</div>
                    <div className="result-value">{analysisResult.symptoms}</div>
                  </div>
                  
                  <div className="result-item">
                    <div className="result-label">Treatment</div>
                    <div className="result-value">{analysisResult.treatment}</div>
                  </div>
                </div>
              </div>

              {/* Chat Box */}
              <div className="chat-container">
                <div className="chat-history">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.sender}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="chat-input-area">
                  <input 
                    type="text" 
                    placeholder="Ask AI a follow-up..." 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{padding: '0.5rem 1rem'}}>Send</button>
                </form>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
