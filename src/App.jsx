import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [photos, setPhotos] = useState([])
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [isShuffling, setIsShuffling] = useState(false)
  const [shufflingIndex, setShufflingIndex] = useState(-1)
  
  // Timer & Modal States
  const [modalPhase, setModalPhase] = useState('CLOSED'); // CLOSED, CHOICE, ENGLISH, DISCUSSION
  const [cambioCount, setCambioCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [showSelectPrompt, setShowSelectPrompt] = useState(false);
  const [selectInputValue, setSelectInputValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [actionTimer, setActionTimer] = useState(0);

  const shuffleInterval = useRef(null)

  useEffect(() => {
    // Caricamento iniziale delle foto all'avvio dell'app
    if (window.electronAPI) {
      window.electronAPI.getPhotos().then(data => {
        setPhotos(data)
      })
    }
  }, [])

  // Gestione Tick del Timer
  useEffect(() => {
    let interval = null;
    if (timerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  // Gestione Tick dell'Action Timer (lockout 3s)
  useEffect(() => {
    let interval = null;
    if (actionTimer > 0) {
      interval = setInterval(() => {
        setActionTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [actionTimer]);

  const togglePhoto = (name) => {
    if (isShuffling) return;
    const updatedPhotos = photos.map(p => 
      p.name === name ? { ...p, active: !p.active } : p
    )
    setPhotos(updatedPhotos)
    
    // Salvataggio nello Store di Electron
    if (window.electronAPI) {
      window.electronAPI.savePhotos(updatedPhotos)
    }
  }

  const activateAll = () => {
    if (isShuffling) return;
    const updatedPhotos = photos.map(p => ({ ...p, active: true }));
    setPhotos(updatedPhotos);
    if (window.electronAPI) {
      window.electronAPI.savePhotos(updatedPhotos);
    }
  }

  const deactivateAll = () => {
    if (isShuffling) return;
    const updatedPhotos = photos.map(p => ({ ...p, active: false }));
    setPhotos(updatedPhotos);
    if (window.electronAPI) {
      window.electronAPI.savePhotos(updatedPhotos);
    }
  }

  const executeShuffle = (currentPhotos, targetCambioCount) => {
    const activePhotos = currentPhotos.filter(p => p.active);
    if (activePhotos.length === 0) {
      alert("Nessuna foto attiva!");
      return;
    }

    setIsShuffling(true);
    setSelectedPhoto(null);
    setModalPhase('CLOSED');
    
    let iterations = 0;
    const maxIterations = 20;
    const intervalTime = 100;

    shuffleInterval.current = setInterval(() => {
      const randomActive = activePhotos[Math.floor(Math.random() * activePhotos.length)];
      const randomIndex = currentPhotos.findIndex(p => p.name === randomActive.name);
      setShufflingIndex(randomIndex);
      
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(shuffleInterval.current);
        
        const finalPhoto = activePhotos[Math.floor(Math.random() * activePhotos.length)];
        const finalIndex = currentPhotos.findIndex(p => p.name === finalPhoto.name);
        
        setShufflingIndex(finalIndex);
        setTimeout(() => {
          setSelectedPhoto(finalPhoto);
          setIsShuffling(false);
          setShufflingIndex(-1);
          setModalPhase('CHOICE');
          setActionTimer(3);

          if (targetCambioCount === 2) {
            setTimeLeft(0);
            setTotalTime(60); // Per riferimento visuale
            setTimerRunning(false);
          }
          else if (targetCambioCount === 1) {
            setTimeLeft(30);
            setTotalTime(30);
            setTimerRunning(true);
          }
          else {
            setTimeLeft(60);
            setTotalTime(60);
            setTimerRunning(true);
          }

          // Disattiva la foto estratta
          setPhotos(prevPhotos => {
            const updated = prevPhotos.map(p => 
              p.name === finalPhoto.name ? { ...p, active: false } : p
            );
            if (window.electronAPI) window.electronAPI.savePhotos(updated);
            return updated;
          });
        }, 500);
      }
    }, intervalTime);
  }

  const handleSelectSpecificPhoto = () => {
    const num = parseInt(selectInputValue, 10);
    if (isNaN(num) || num < 1 || num > photos.length) {
      alert("Numero non valido!");
      return;
    }
    const finalPhoto = photos[num - 1];
    setCambioCount(0);
    setSelectedPhoto(finalPhoto);
    setModalPhase('CHOICE');
    setActionTimer(3);
    setTimeLeft(60);
    setTotalTime(60);
    setTimerRunning(true);
    setShowSelectPrompt(false);
    setSelectInputValue("");

    setPhotos(prevPhotos => {
      const updated = prevPhotos.map(p => 
        p.name === finalPhoto.name ? { ...p, active: false } : p
      );
      if (window.electronAPI) window.electronAPI.savePhotos(updated);
      return updated;
    });
  }

  const startShuffle = () => {
    if (isShuffling) return;
    setCambioCount(0);
    executeShuffle(photos, 0);
  }

  const handleCambio = () => {
    if (actionTimer > 0) return;
    if (cambioCount === 1) {
      setShowWarning(true);
      return;
    }
    const nextCambioCount = cambioCount + 1;
    setCambioCount(nextCambioCount);
    executeShuffle(photos, nextCambioCount);
  }

  const confirmCambio = () => {
    setShowWarning(false);
    const nextCambioCount = cambioCount + 1;
    setCambioCount(nextCambioCount);
    executeShuffle(photos, nextCambioCount);
  }

  const cancelCambio = () => {
    setShowWarning(false);
  }

  const handleProcedi = () => {
    if (actionTimer > 0) return;
    setModalPhase('ENGLISH');
    setActionTimer(3);
    setTimeLeft(60);
    setTotalTime(60);
    setTimerRunning(true);
  };

  const handlePassaDiscussione = () => {
    setModalPhase('DISCUSSION');
    setActionTimer(3);
    setTimerRunning(true);
    setTimeLeft(420); // 7 minuti
    setTotalTime(420);
  };

  const handleSwitchSection = () => {
    if (actionTimer > 0) return;
    if (modalPhase === 'ENGLISH') {
      handlePassaDiscussione();
    } else if (modalPhase === 'DISCUSSION') {
      setModalPhase('ENGLISH');
      setActionTimer(3);
      if (cambioCount === 1) {
        setTimeLeft(30);
        setTotalTime(30);
        setTimerRunning(true);
      } else if (cambioCount === 2) {
        setTimeLeft(0);
        setTotalTime(60);
        setTimerRunning(false);
      } else {
        setTimeLeft(60);
        setTotalTime(60);
        setTimerRunning(true);
      }
    }
  };

  const handleConcludi = () => {
    if (actionTimer > 0) return;
    setModalPhase('CLOSED');
    setSelectedPhoto(null);
    setTimerRunning(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="container">
      <div className="top-bar">
        <div className="batch-controls">
          <button 
            className="batch-button special" 
            onClick={() => setShowSelectPrompt(true)} 
            disabled={isShuffling}
            style={{ color: "var(--accent)", borderColor: "rgba(255, 215, 0, 0.4)" }}
          >
            Scegli Foto
          </button>
          <button className="batch-button" onClick={activateAll} disabled={isShuffling}>Attiva Tutti</button>
          <button className="batch-button" onClick={deactivateAll} disabled={isShuffling}>Disattiva Tutti</button>
        </div>
        <div className="controls">
          <button 
            className={`shuffle-button ${isShuffling ? 'disabled' : ''}`} 
            onClick={startShuffle}
            disabled={isShuffling}
          >
            {isShuffling ? 'Estrazione in corso...' : 'Scegli a Caso'}
          </button>
        </div>
        <div className="top-right-spacer"></div>
      </div>

      <div className="photo-grid">
        {photos.length === 0 && <p className="no-photos">Nessuna foto trovata nella cartella "foto".</p>}
        {photos.map((photo, index) => (
          <div 
            key={photo.name} 
            className={`photo-box ${!photo.active ? 'inactive' : ''} ${shufflingIndex === index ? 'shuffling' : ''} ${selectedPhoto?.name === photo.name ? 'selected' : ''}`}
            onClick={() => togglePhoto(photo.name)}
          >
            <div className="box-content">
              {selectedPhoto?.name === photo.name ? (
                <img 
                  src={`app-photos:///${encodeURIComponent(photo.name)}`} 
                  alt={photo.name} 
                  className="revealed-photo"
                />
              ) : (
                <span className="box-number">{index + 1}</span>
              )}
            </div>
            {!photo.active && <div className="status-overlay">Disattiva</div>}
          </div>
        ))}
      </div>

      {modalPhase !== 'CLOSED' && selectedPhoto && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="screen-timer-container">
            <svg className="screen-timer-svg">
              <rect className="timer-rect-bg" x="0" y="0" width="100%" height="100%" />
              <rect 
                className="timer-rect-progress" 
                x="0" y="0" width="100%" height="100%"
                pathLength="100"
                style={{
                  strokeDasharray: "100",
                  strokeDashoffset: totalTime > 0 ? 100 - (timeLeft / totalTime * 100) : 0,
                  stroke: timeLeft <= 10 && timerRunning ? '#ff4d4d' : 'var(--accent)'
                }}
              />
            </svg>
            
            <div className="modal-content-inner">
              <div className="photo-container-full">
                <img 
                  src={`app-photos:///${encodeURIComponent(selectedPhoto.name)}`} 
                  alt={selectedPhoto.name} 
                  className="modal-photo-adaptive"
                />
              </div>

              <div className="modal-info-overlay">
                <div className="timer-text-new">
                  {formatTime(timeLeft)}
                </div>
                <div className="phase-title-new">
                  {modalPhase === 'CHOICE' && 'Fase di Scelta'}
                  {modalPhase === 'ENGLISH' && 'Parte in Inglese'}
                  {modalPhase === 'DISCUSSION' && 'Discussione'}
                </div>
              </div>

              <div className="photo-number-overlay">
                #{photos.findIndex(p => p.name === selectedPhoto.name) + 1}
              </div>

              {cambioCount === 2 && (
                <div className="penalty-indicator">
                  -5 punti di penalità
                </div>
              )}

              <div className="modal-actions-bar">
                {modalPhase === 'CHOICE' && (
                  <>
                    <button 
                      className="action-btn primary" 
                      onClick={handleProcedi}
                      disabled={actionTimer > 0}
                    >
                      Procedi {actionTimer > 0 ? `(${actionTimer}s)` : ''}
                    </button>
                    {cambioCount < 2 && (
                      <button 
                        className="action-btn secondary" 
                        onClick={handleCambio}
                        disabled={actionTimer > 0}
                      >
                        Cambio ({2 - cambioCount} {cambioCount === 1 ? 'rimasto' : 'rimasti'}) {actionTimer > 0 ? `(${actionTimer}s)` : ''}
                      </button>
                    )}
                  </>
                )}

                {modalPhase === 'ENGLISH' && (
                  <>
                    <button 
                      className="action-btn primary" 
                      onClick={handleSwitchSection}
                      disabled={actionTimer > 0}
                    >
                      Procedi {actionTimer > 0 ? `(${actionTimer}s)` : ''}
                    </button>
                    {!timerRunning && timeLeft === totalTime && (
                      <button className="action-btn play" onClick={() => setTimerRunning(true)}>Avvia Timer</button>
                    )}
                  </>
                )}

                {modalPhase === 'DISCUSSION' && (
                  <>
                    {!timerRunning && timeLeft === totalTime && (
                      <button className="action-btn play" onClick={() => setTimerRunning(true)}>Avvia Timer</button>
                    )}
                    <button 
                      className="action-btn danger" 
                      onClick={handleConcludi}
                      disabled={actionTimer > 0}
                    >
                      Concludi {actionTimer > 0 ? `(${actionTimer}s)` : ''}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showWarning && (
        <div className="warning-overlay">
          <div className="warning-modal">
            <h2>ATTENZIONE!</h2>
            <p>Se continui con il terzo ed ultimo tentativo, ti verranno sottratti <strong>5 punti</strong> di penalità.</p>
            <div className="warning-actions">
              <button className="action-btn danger" onClick={confirmCambio}>Conferma e Continua</button>
              <button className="action-btn secondary" onClick={cancelCambio}>Torna Indietro</button>
            </div>
          </div>
        </div>
      )}

      {showSelectPrompt && (
        <div className="warning-overlay">
          <div className="warning-modal">
            <h2 style={{ color: "var(--accent)" }}>Scegli Foto</h2>
            <p>Inserisci il numero della foto (1 - {photos.length}):</p>
            <input 
              type="number" 
              value={selectInputValue} 
              onChange={e => setSelectInputValue(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelectSpecificPhoto();
              }}
              min="1" max={photos.length}
              style={{ 
                padding: '0.8rem', fontSize: '1.5rem', marginBottom: '1.5rem', 
                borderRadius: '8px', border: '2px solid rgba(255, 215, 0, 0.5)', 
                background: '#111', color: 'var(--accent)', width: '120px', 
                textAlign: 'center', fontWeight: 'bold' 
              }}
              autoFocus
            />
            <div className="warning-actions">
              <button className="action-btn primary" onClick={handleSelectSpecificPhoto}>Conferma</button>
              <button className="action-btn secondary" onClick={() => {
                setShowSelectPrompt(false);
                setSelectInputValue("");
              }}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

