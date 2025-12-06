import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import BoundingBoxOverlay from './components/BoundingBoxOverlay';
import { detectObjectsInScene, compareScenes } from './services/geminiService';
import { SceneReference, DetectedObject, ViewMode, ObjectStatus, BoundingBox, FeatureItem } from './types';
import { initDB, getAllFeatures, addFeature, deleteFeature, updateFeature } from './services/db';
import { Camera, Trash2, Play, Pause, Upload, Loader2, Eye, Images, EyeOff, X, RotateCcw, ChevronDown, ChevronUp, ListFilter, Save, Plus, ImageIcon, Video, VideoOff, Pencil, Check } from 'lucide-react';

const DEFAULT_FEATURES: Omit<FeatureItem, 'id'>[] = [
  {
    img: "https://lh3.googleusercontent.com/d/1h8Yd4g5z4HIX13m9qTCF7aQcdwxylNRO",
    title: "Idhi chaduvu mundu gadidha!",
    desc: "Stop clicking blindly like a monkey! I am Bala Holmes, and I am here to explain this high-tech machinery to you."
  },
  {
    img: "https://lh3.googleusercontent.com/d/1889m8uqBNdwgIc6AWO8J9E7ZG2YcvKxG",
    title: "1. Create Reference",
    desc: "First, you show me a room. I memorize everything. Every spoon, every dust bunny. Don't shake the camera."
  },
  {
    img: "https://lh3.googleusercontent.com/d/1xd1EftsuQz4Mse_CDhvJGS-o-pUKd12a",
    title: "2. Monitor Mode",
    desc: "Then, I watch. If someone moves your biryani or steals a pen, I will catch them. It's AI monitoring, but better."
  },
  {
    img: "https://lh3.googleusercontent.com/d/1bNU55AgFpLdJNfVLM5PTeXBHFuDAF8ez",
    title: "3. Photo Compare",
    desc: "Got two photos? Upload them. I'll spot the differences faster than your aunty spots a flaw in your wedding match."
  },
  {
    img: "https://lh3.googleusercontent.com/d/1gRa6rrTjRYCTRbkQ8HPCUq5T4tV3G2Fr",
    title: "Current Bugs",
    desc: "This is just a basic object detection model used for prototype. Inka Ai vada ledu adhi implement chesta dabidi dibide"
  },
  {
    img: "https://lh3.googleusercontent.com/d/1nIDW4eVxrzTS81WgnaUt4--5vj27QSdF",
    title: "It's a Prototype, Relax",
    desc: "Just the beginning stage. We are adding more features. Don't complain if it breaks, just refresh."
  },
  {
    img: "https://lh3.googleusercontent.com/d/18I6OII4JMGrANoNnGU9yxL7TxdC_rwP_",
    title: "Inka chala stuff undi dacham",
    desc: "We have hidden a lot more stuff. Go explore. And behave yourself."
  }
];


// --- Reusable Custom Components ---

interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  icon?: any;
  placeholder?: string;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  options, 
  onChange, 
  icon: Icon, 
  placeholder = "Select...",
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 w-full flex items-center justify-between gap-3 bg-[#121416] hover:bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 transition-all outline-none focus:border-white/30 group whitespace-nowrap shadow-sm hover:shadow-md"
        title={selectedOption?.label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {Icon && <Icon className="w-4 h-4 text-white/50 shrink-0" />}
          <span className="truncate block text-left font-medium text-white/90">
            {selectedOption ? selectedOption.label : <span className="text-white/40">{placeholder}</span>}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          role="listbox"
          className="absolute top-[calc(100%+8px)] left-0 min-w-full w-max max-w-[350px] bg-[#1A1D21] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50"
        >
          <div className="p-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={value === opt.value}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg transition-colors border border-transparent ${
                  value === opt.value 
                    ? 'bg-white/10 text-white font-medium border-white/5' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${value === opt.value ? 'bg-status-present shadow-[0_0_8px_rgba(105,240,174,0.5)]' : 'bg-transparent'}`} />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
            {options.length === 0 && (
                <div className="px-3 py-4 text-sm text-white/30 text-center italic">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // --- Global Navigation & Mode ---
  const [view, setView] = useState<ViewMode>('features');
  
  // --- Core App Data ---
  const [references, setReferences] = useState<SceneReference[]>([]);
  const [activeRefId, setActiveRefId] = useState<string | null>(null);
  
  // --- Features Data & DB State ---
  const [featuresList, setFeaturesList] = useState<FeatureItem[]>([]);
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [newFeature, setNewFeature] = useState<{title: string, desc: string, img: string | null}>({ title: '', desc: '', img: null });
  const [inputType, setInputType] = useState<'upload' | 'url'>('upload');

  // --- Camera State ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // --- Processing State ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMonitoringScanInProgress, setIsMonitoringScanInProgress] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentFrameImage, setCurrentFrameImage] = useState<string | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const scanLoopRef = useRef<number>();

  // --- Editing States ---
  const [editingRefName, setEditingRefName] = useState<string>("");
  const [renamingObjectId, setRenamingObjectId] = useState<string | null>(null);
  const [tempObjectName, setTempObjectName] = useState("");
  const [renamingRefId, setRenamingRefId] = useState<string | null>(null);
  const [tempRefName, setTempRefName] = useState("");

  // --- Photo Compare State ---
  const [photoCompareRef, setPhotoCompareRef] = useState<string | null>(null);
  const [photoCompareLive, setPhotoCompareLive] = useState<string | null>(null);
  const [photoCompareResults, setPhotoCompareResults] = useState<DetectedObject[]>([]);
  
  const stopTracks = useCallback((mediaStream: MediaStream | null) => {
      if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
      }
  }, []);

  useEffect(() => {
    getDevices();
    
    const initAppDB = async () => {
       await initDB(DEFAULT_FEATURES);
       const feats = await getAllFeatures();
       feats.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
       setFeaturesList(feats);
    };
    initAppDB();

    return () => stopTracks(streamRef.current);
  }, []);

  const handleAddFeature = async () => {
    if (!newFeature.title || !newFeature.desc || !newFeature.img) return;
    try {
      await addFeature({ ...newFeature, isDefault: false, order: featuresList.length });
      const feats = await getAllFeatures();
      feats.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
      setFeaturesList(feats);
      setNewFeature({ title: '', desc: '', img: null });
      setIsAddingFeature(false);
    } catch (e) { console.error("Failed to add feature", e); }
  };

  const handleUpdateImage = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const newImg = ev.target?.result as string;
        const itemIndex = featuresList.findIndex(f => f.id === id);
        if (itemIndex > -1) {
            const updatedItem = { ...featuresList[itemIndex], img: newImg };
            const newList = [...featuresList];
            newList[itemIndex] = updatedItem;
            setFeaturesList(newList);
            try { await updateFeature(updatedItem); } 
            catch (err) { console.error("Failed to update feature image in DB", err); }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMoveFeature = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === featuresList.length - 1)) return;
    const newFeatures = [...featuresList];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFeatures[index], newFeatures[swapIndex]] = [newFeatures[swapIndex], newFeatures[index]];
    newFeatures.forEach((f, i) => f.order = i);
    setFeaturesList(newFeatures);
    try {
      for (const f of newFeatures) { await updateFeature(f); }
    } catch (e) { console.error("Failed to update order", e); }
  };

  const handleDeleteFeature = async (id: number) => {
    if (confirm("Are you sure?")) {
      try {
        await deleteFeature(id);
        const feats = await getAllFeatures();
        feats.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
        setFeaturesList(feats);
      } catch (e) { console.error("Failed to delete feature", e); }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewFeature(prev => ({ ...prev, img: ev.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const getDevices = async () => {
    try {
      try {
         const initStream = await navigator.mediaDevices.getUserMedia({ video: true });
         initStream.getTracks().forEach(track => track.stop());
      } catch (e) { console.warn("Permission check failed", e); }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch (err) { console.error("Error enumerating devices:", err); }
  };

  const startStream = async (deviceId?: string) => {
    setCameraError(null);
    try {
      const targetDeviceId = (!deviceId || deviceId === 'default') ? undefined : { exact: deviceId };
      const constraints = { video: { deviceId: targetDeviceId, width: { ideal: 1280 }, height: { ideal: 720 } } };
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("Constraint match failed, trying fallback...", err);
        newStream = await navigator.mediaDevices.getUserMedia({ video: targetDeviceId ? { deviceId: targetDeviceId } : true });
      }
      stopTracks(streamRef.current);
      streamRef.current = newStream;
      setStream(newStream);
      setIsCameraEnabled(true);
    } catch (err: any) {
      let msg = "An unknown error occurred.";
      if (err.name === 'NotAllowedError') msg = "Camera access denied.";
      else if (err.name === 'NotFoundError') msg = "No camera found.";
      else if (err.name === 'NotReadableError') msg = "Camera in use by another app.";
      setCameraError(msg);
      setIsCameraEnabled(false);
    }
  };

  useEffect(() => {
    if (isCameraEnabled && stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Autoplay prevented:", e));
    }
  }, [isCameraEnabled, stream]);

  const stopStream = () => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setIsCameraEnabled(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  
  const toggleCamera = () => isCameraEnabled ? stopStream() : startStream(selectedDeviceId);

  useEffect(() => {
    if ((view === 'create-reference' || view === 'monitor') && isCameraEnabled && !currentFrameImage && !stream) {
        startStream(selectedDeviceId);
    } 
    if (view !== 'monitor') setMonitoringActive(false);
  }, [view, isCameraEnabled]);

  const captureFrame = useCallback((quality: 'high' | 'medium' = 'medium', checkBrightness = false): string | null => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return null;
    const { videoWidth, videoHeight } = videoRef.current;
    const canvas = canvasRef.current;
    const MAX_WIDTH = quality === 'high' ? 1024 : 800;
    let width = videoWidth, height = videoHeight;
    if (width > MAX_WIDTH) {
      height = Math.round(height * (MAX_WIDTH / width));
      width = MAX_WIDTH;
    }
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality === 'high' ? 0.8 : 0.6);
  }, []);

  const handleCaptureReference = async () => {
    setIsProcessing(true);
    const dataUrl = captureFrame('high', true) || captureFrame('high', false);
    if (!dataUrl) {
      setIsProcessing(false);
      return;
    }
    setCurrentFrameImage(dataUrl);
    try {
      const objects = await detectObjectsInScene(dataUrl);
      setDetectedObjects(objects);
      setEditingRefName(`Scene ${references.length + 1}`);
    } catch (err) {
      console.error(err);
      alert("Failed to analyze scene. Please retake.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveReference = () => {
    if (!currentFrameImage) return;
    const newRef: SceneReference = {
      id: Date.now().toString(),
      name: editingRefName || `Reference ${references.length + 1}`,
      imageData: currentFrameImage,
      createdAt: Date.now(),
      objects: detectedObjects
    };
    setReferences([...references, newRef]);
    setView('dashboard');
    setCurrentFrameImage(null);
    setDetectedObjects([]);
    stopStream();
  };

  const handleRetake = () => {
    setCurrentFrameImage(null);
    setDetectedObjects([]);
    setIsCameraEnabled(true); 
    startStream();
  };

  const toggleObjectVisibility = (id: string) => setDetectedObjects(p => p.map(o => o.id === id ? { ...o, userHidden: !o.userHidden } : o));
  const handleDeleteObject = (id: string) => setDetectedObjects(p => p.filter(o => o.id !== id));
  const startRenamingObject = (obj: DetectedObject) => { setRenamingObjectId(obj.id); setTempObjectName(obj.label); };
  const saveRenamedObject = () => {
    if (renamingObjectId) {
      setDetectedObjects(p => p.map(o => o.id === renamingObjectId ? { ...o, label: tempObjectName } : o));
      setRenamingObjectId(null);
    }
  };
  const startRenamingRef = (ref: SceneReference) => { setRenamingRefId(ref.id); setTempRefName(ref.name); };
  const saveRenamedRef = () => {
    if (renamingRefId) {
      setReferences(p => p.map(r => r.id === renamingRefId ? { ...r, name: tempRefName } : r));
      setRenamingRefId(null);
    }
  };

  const performScan = useCallback(async () => {
    const activeRef = references.find(r => r.id === activeRefId);
    if (!activeRef || isMonitoringScanInProgress) return;
    const liveFrame = captureFrame('medium');
    if (!liveFrame) return;
    setIsMonitoringScanInProgress(true);
    try {
      const newResults = await compareScenes(activeRef.imageData, liveFrame, []);
      setDetectedObjects(newResults);
    } catch (err) {
      console.error("Scan failed", err);
    } finally {
      setIsMonitoringScanInProgress(false);
    }
  }, [activeRefId, references, captureFrame, isMonitoringScanInProgress]);

  useEffect(() => {
    if (!monitoringActive || !isCameraEnabled || !stream) {
      return;
    }
    
    let lastScanTime = 0;
    const SCAN_INTERVAL = 2000; // 2 seconds

    const scanLoop = (timestamp: number) => {
        if (!monitoringActiveRef.current) return; // Check if still active
        if (timestamp - lastScanTime > SCAN_INTERVAL) {
            lastScanTime = timestamp;
            performScan();
        }
        scanLoopRef.current = requestAnimationFrame(scanLoop);
    };

    const monitoringActiveRef = { current: true };
    scanLoopRef.current = requestAnimationFrame(scanLoop);

    return () => {
        monitoringActiveRef.current = false;
        if (scanLoopRef.current) {
            cancelAnimationFrame(scanLoopRef.current);
        }
    };
  }, [monitoringActive, isCameraEnabled, stream, performScan]);

  const toggleMonitoring = () => {
    if (!monitoringActive && (!activeRefId || !isCameraEnabled)) {
      alert(!activeRefId ? "Please select a reference scene first." : "Please start the camera first.");
      return;
    }
    setMonitoringActive(prev => !prev);
  };

  const handlePhotoCompare = async () => {
    if (!photoCompareRef || !photoCompareLive) return;
    setIsProcessing(true);
    try {
      const results = await compareScenes(photoCompareRef, photoCompareLive, []);
      setPhotoCompareResults(results);
    } catch (err) {
      console.error(err);
      alert("Comparison failed.");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const cameraOptions = useMemo(() => [
    { value: 'default', label: 'Default Webcam' },
    ...availableDevices.map(d => ({ value: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0,5)}` }))
  ], [availableDevices]);

  const referenceOptions = useMemo(() => [
    { value: "", label: "Select Reference..." },
    ...references.map(r => ({ value: r.id, label: r.name }))
  ], [references]);

  const renderCreateReference = () => (
    <div className="h-full flex flex-col gap-6">
      <div className="relative z-50 flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
         <div className="flex items-center gap-4">
             {!currentFrameImage && (
               <>
                 <button 
                    onClick={toggleCamera}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border shrink-0 whitespace-nowrap ${
                        isCameraEnabled 
                        ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                        : 'bg-status-present text-black border-status-present hover:bg-white'
                    }`}
                 >
                    {isCameraEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    {isCameraEnabled ? "Stop Camera" : "Start Camera"}
                 </button>
                 <CustomSelect 
                    value={selectedDeviceId} 
                    options={cameraOptions} 
                    onChange={(val) => { setSelectedDeviceId(val); if(isCameraEnabled) startStream(val); }} 
                    icon={Camera}
                    className="w-72 shrink-0 z-[60]" 
                 />
               </>
             )}
         </div>
         {currentFrameImage && (
             <div className="flex items-center gap-2">
                 <input 
                   type="text" 
                   value={editingRefName}
                   onChange={(e) => setEditingRefName(e.target.value)}
                   placeholder="Name this reference..."
                   className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-fog-accent"
                 />
             </div>
         )}
      </div>
      <div className="flex-1 flex gap-6 overflow-hidden">
         <div className="flex-1 bg-black rounded-[32px] overflow-hidden relative shadow-2xl border border-white/10 group">
            {currentFrameImage ? (
                <div className="relative w-full h-full flex items-center justify-center bg-[#0a0a0a] scale-105 origin-center">
                    <img src={currentFrameImage} alt="Captured" className="max-w-full max-h-full object-contain" />
                    <BoundingBoxOverlay objects={detectedObjects} containerWidth={1000} containerHeight={1000} />
                </div>
            ) : (
                <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center scale-105 origin-center">
                    <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-contain ${isCameraEnabled ? '' : 'hidden'}`} />
                    <canvas ref={canvasRef} className="hidden" />
                    {!isCameraEnabled && (
                        <div className="text-center absolute inset-0 flex flex-col items-center justify-center z-10">
                            <p className="text-white/40 mb-6">Camera is turned off</p>
                            <button onClick={() => startStream(selectedDeviceId)} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold text-white flex items-center gap-2 mx-auto transition-all">
                                <Video className="w-5 h-5" /> Start Camera
                            </button>
                        </div>
                    )}
                </div>
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30">
                {!currentFrameImage && isCameraEnabled && (
                    <button onClick={handleCaptureReference} disabled={isProcessing} className="h-16 px-8 bg-white text-black rounded-full font-bold text-lg flex items-center gap-3 shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 whitespace-nowrap">
                        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Capture Scene"}
                    </button>
                )}
                {currentFrameImage && (
                    <>
                        <button onClick={handleRetake} className="h-14 px-6 bg-black/60 backdrop-blur-md text-white border border-white/20 rounded-full font-bold flex items-center gap-2 hover:bg-black/80 transition-all">
                            <RotateCcw className="w-5 h-5" /> Retake
                        </button>
                        <button onClick={handleSaveReference} className="h-14 px-8 bg-fog-accent text-fog-base rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-fog-accent/20">
                            <Save className="w-5 h-5" /> Save Reference
                        </button>
                    </>
                )}
            </div>
         </div>
         {currentFrameImage && (
             <div className="w-96 shrink-0 bg-[#121416] border border-white/10 rounded-[32px] flex flex-col overflow-hidden shadow-xl animate-in slide-in-from-right duration-300">
                 <div className="p-6 border-b border-white/10">
                     <h3 className="font-bold text-white text-lg flex items-center gap-2"><ListFilter className="w-5 h-5 text-fog-accent" /> Detected Objects</h3>
                     <p className="text-white/40 text-sm mt-1">{detectedObjects.length} objects found.</p>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     <div className="space-y-2">
                         {detectedObjects.map((obj) => (
                             <div key={obj.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all group/item ${obj.userHidden ? 'bg-white/5 border-transparent opacity-50' : 'bg-white/5 border-white/10 hover:border-fog-accent/50'}`}>
                                 {renamingObjectId === obj.id ? (
                                    <div className="flex items-center gap-2 flex-1 mr-2">
                                        <input type="text" autoFocus value={tempObjectName} onChange={(e) => setTempObjectName(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-fog-accent" onKeyDown={(e) => { if(e.key === 'Enter') saveRenamedObject(); }}/>
                                        <button onClick={saveRenamedObject} className="p-1 text-green-400 hover:bg-green-400/10 rounded"><Check className="w-4 h-4"/></button>
                                    </div>
                                 ) : (
                                    <span className="font-medium text-white/90 truncate mr-2 flex-1" title={obj.label}>{obj.label}</span>
                                 )}
                                 <div className="flex items-center gap-1">
                                    {renamingObjectId !== obj.id && (
                                        <>
                                            <button onClick={() => startRenamingObject(obj)} className="p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"> <Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDeleteObject(obj.id)} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </>
                                    )}
                                    <button onClick={() => toggleObjectVisibility(obj.id)} className={`p-1.5 rounded-lg transition-colors ${obj.userHidden ? 'text-white/30 hover:text-white' : 'text-fog-accent hover:bg-fog-accent/10'}`}>{obj.userHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
         )}
      </div>
    </div>
  );

  const renderMonitor = () => (
    <div className="h-full flex flex-col gap-6">
       <div className="relative z-50 flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
           <button onClick={toggleCamera} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border shrink-0 whitespace-nowrap ${ isCameraEnabled ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}>
                {isCameraEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />} {isCameraEnabled ? "Stop Cam" : "Start Cam"}
           </button>
           <div className="h-8 w-px bg-white/10 mx-2" />
           <CustomSelect value={activeRefId || ""} options={referenceOptions} onChange={(val) => { setActiveRefId(val); setMonitoringActive(false); }} placeholder="Select Scene to Monitor" icon={Images} className="w-80 shrink-0 z-[50]"/>
           <CustomSelect value={selectedDeviceId} options={cameraOptions} onChange={(val) => { setSelectedDeviceId(val); if(isCameraEnabled) startStream(val); }} icon={Camera} className="w-72 shrink-0 z-[50]"/>
           <div className="flex-1" />
           {activeRefId && (
               <button onClick={toggleMonitoring} disabled={!isCameraEnabled} className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shrink-0 ${ monitoringActive ? 'bg-red-500 text-white border border-red-400 animate-pulse' : 'bg-status-present text-black hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-gray-700 disabled:text-gray-400'}`}>
                   {monitoringActive ? (<><Pause className="w-5 h-5 fill-current" />STOP MONITORING</>) : (<><Play className="w-5 h-5 fill-current" />START MONITORING</>)}
               </button>
           )}
       </div>
       <div className="flex-1 bg-black rounded-[32px] overflow-hidden relative shadow-2xl border border-white/10">
          <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center">
               <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-contain ${isCameraEnabled ? 'opacity-90' : 'hidden'}`} />
               <canvas ref={canvasRef} className="hidden" />
               {!isCameraEnabled && (<div className="text-center opacity-50 absolute inset-0 flex flex-col items-center justify-center z-10"><h3 className="text-xl font-bold text-white/50">Camera is Off</h3><p className="text-white/30 text-sm mt-2">Start camera to begin monitoring</p></div>)}
               {monitoringActive && (<BoundingBoxOverlay objects={detectedObjects} containerWidth={1000} containerHeight={1000} />)}
               <div className="absolute top-6 left-6 flex flex-col gap-2">
                   {monitoringActive && (<div className="px-4 py-2 rounded-lg backdrop-blur-md border flex items-center gap-3 bg-green-500/10 border-green-500/30 text-green-400"><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" /><span className="font-mono text-sm font-bold uppercase tracking-wider">SYSTEM ARMED</span></div>)}
                   {isMonitoringScanInProgress && (<div className="px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-xs text-white/60 flex items-center gap-2 w-max"><Loader2 className="w-3 h-3 animate-spin" />Scanning...</div>)}
               </div>
          </div>
       </div>
    </div>
  );

  const renderPhotoCompare = () => (
    <div className="h-full flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-6 h-[400px]">
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><span className="w-2 h-2 bg-fog-accent rounded-full"/> Reference Image</h3>
                    {photoCompareRef && (<button onClick={() => setPhotoCompareRef(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4"/></button>)}
                </div>
                <div className="flex-1 bg-black/20 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden transition-colors hover:border-white/20">
                    {photoCompareRef ? (<img src={photoCompareRef} alt="Ref" className="w-full h-full object-contain" />) : (<div className="text-center p-6"><Upload className="w-10 h-10 text-white/20 mx-auto mb-3" /><p className="text-white/40 text-sm">Upload "Before" Image</p></div>)}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => setPhotoCompareRef(ev.target?.result as string); reader.readAsDataURL(file); } }}/>
                </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><span className="w-2 h-2 bg-status-new rounded-full"/> Live Image</h3>
                    {photoCompareLive && (<button onClick={() => { setPhotoCompareLive(null); setPhotoCompareResults([]); }} className="text-white/40 hover:text-white"><X className="w-4 h-4"/></button>)}
                </div>
                <div className="flex-1 bg-black/20 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden transition-colors hover:border-white/20">
                    {photoCompareLive ? (<div className="relative w-full h-full flex items-center justify-center"><img src={photoCompareLive} alt="Live" className="w-full h-full object-contain" /> {photoCompareResults.length > 0 && (<BoundingBoxOverlay objects={photoCompareResults} containerWidth={1000} containerHeight={1000} />)}</div>) : (<div className="text-center p-6"><Upload className="w-10 h-10 text-white/20 mx-auto mb-3" /><p className="text-white/40 text-sm">Upload "After" Image</p></div>)}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { setPhotoCompareLive(ev.target?.result as string); setPhotoCompareResults([]); }; reader.readAsDataURL(file); } }}/>
                </div>
            </div>
        </div>
        <div className="flex items-center justify-center py-6">
             <button onClick={handlePhotoCompare} disabled={!photoCompareRef || !photoCompareLive || isProcessing} className="px-8 py-4 bg-fog-accent text-fog-base rounded-full font-bold text-lg flex items-center gap-3 shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100">
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />} {isProcessing ? "Analyzing Differences..." : "Compare Images"}
             </button>
        </div>
        {photoCompareResults.length > 0 && (
            <div className="flex-1 bg-white/5 border border-white/10 rounded-[32px] p-6 overflow-hidden flex flex-col">
                <h3 className="text-white font-bold mb-4">Comparison Results</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {photoCompareResults.map(obj => (
                             <div key={obj.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-start gap-3">
                                 <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${ obj.status === ObjectStatus.MISSING ? 'bg-status-missing' : obj.status === ObjectStatus.NEW ? 'bg-status-new' : 'bg-status-present'}`} />
                                 <div>
                                     <div className="font-bold text-white text-sm">{obj.label}</div>
                                     <div className="text-xs text-white/50 uppercase font-mono mt-1">{obj.status}</div>
                                 </div>
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={() => setView('create-reference')} className="group relative overflow-hidden bg-white/5 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Camera className="w-32 h-32 text-white" /></div>
          <div className="bg-gradient-to-br from-fog-accent/50 to-fog-panel/50 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg border border-white/10"><Camera className="w-7 h-7" /></div>
          <h3 className="text-2xl font-bold text-white mb-1">Create Reference</h3>
          <p className="text-fog-accent text-sm">Scan a new area or object to monitor.</p>
        </button>
        <button onClick={() => setView('monitor')} className="group relative overflow-hidden bg-white/5 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Eye className="w-32 h-32 text-status-present" /></div>
          <div className="bg-gradient-to-br from-status-present/40 to-status-present/10 w-14 h-14 rounded-2xl flex items-center justify-center text-status-present mb-6 shadow-lg border border-white/10"><Eye className="w-7 h-7" /></div>
          <h3 className="text-2xl font-bold text-white mb-1">Monitor Scene</h3>
          <p className="text-fog-accent text-sm">Real-time anomaly detection.</p>
        </button>
        <button onClick={() => setView('photo-compare')} className="group relative overflow-hidden bg-white/5 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Images className="w-32 h-32 text-status-new" /></div>
          <div className="bg-gradient-to-br from-status-new/40 to-status-new/10 w-14 h-14 rounded-2xl flex items-center justify-center text-status-new mb-6 shadow-lg border border-white/10"><Images className="w-7 h-7" /></div>
          <h3 className="text-2xl font-bold text-white mb-1">Photo Compare</h3>
          <p className="text-fog-accent text-sm">Compare two static images.</p>
        </button>
      </div>
      <div className="bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3"><span className="w-2 h-8 bg-fog-accent rounded-full"></span>Saved References</h2>
        {references.length === 0 ? (
          <div className="text-center py-12 bg-black/20 rounded-2xl border border-white/5">
            <Camera className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-lg">No references saved yet.</p>
            <button onClick={() => setView('create-reference')} className="mt-4 text-fog-accent hover:text-white font-medium">Create your first reference &rarr;</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {references.map((ref) => (
              <div key={ref.id} className="group bg-black/20 rounded-2xl border border-white/5 overflow-hidden hover:border-white/20 transition-all">
                <div className="relative aspect-video">
                  <img src={ref.imageData} alt={ref.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4"><span className="text-white font-medium">{ref.objects.length} Objects</span></div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    {renamingRefId === ref.id ? (
                        <div className="flex items-center gap-2">
                            <input type="text" autoFocus value={tempRefName} onChange={(e) => setTempRefName(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-fog-accent" onKeyDown={(e) => { if(e.key === 'Enter') saveRenamedRef(); }} onClick={(e) => e.stopPropagation()}/>
                            <button onClick={(e) => { e.stopPropagation(); saveRenamedRef(); }} className="p-1 text-green-400"><Check className="w-4 h-4"/></button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 group/title">
                                <h3 className="font-bold text-white text-lg truncate">{ref.name}</h3>
                                <button onClick={(e) => { e.stopPropagation(); startRenamingRef(ref); }} className="opacity-0 group-hover/title:opacity-100 text-white/30 hover:text-white transition-opacity"><Pencil className="w-3.5 h-3.5" /></button>
                            </div>
                            <p className="text-xs text-white/40 mt-1">{new Date(ref.createdAt).toLocaleDateString()}</p>
                        </>
                    )}
                  </div>
                  <button onClick={() => { setReferences(p => p.filter(r => r.id !== ref.id)); if (activeRefId === ref.id) setActiveRefId(null);}} className="p-2 text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderFeatures = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
         <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-12 relative overflow-hidden flex items-center justify-between shadow-2xl">
              <div className="relative z-10 max-w-3xl">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-serif tracking-tight drop-shadow-lg">SceneGuard Capabilities</h2>
                  <p className="text-xl text-white/70 leading-relaxed font-light">Advanced AI-powered scene monitoring, anomaly detection, and change tracking system. Guided by the legendary Bala Holmes.</p>
              </div>
              <div className="z-20 relative hidden md:block">
                  <button onClick={() => setIsAddingFeature(!isAddingFeature)} className="flex items-center gap-2 px-8 py-4 bg-fog-accent text-fog-base rounded-2xl font-bold hover:scale-105 hover:bg-white transition-all duration-300 shadow-[0_0_20px_rgba(143,155,179,0.3)]">
                     {isAddingFeature ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {isAddingFeature ? "Cancel" : "Add Feature"}
                  </button>
              </div>
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fog-accent/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
         </div>
         {isAddingFeature && (
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-[32px] p-8 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
               <h3 className="text-2xl font-bold text-white mb-6">Add New Feature</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div className="space-y-2"><label className="text-sm text-white/60 font-medium ml-1">Feature Title</label><input type="text" placeholder="e.g., Night Vision Mode" value={newFeature.title} onChange={(e) => setNewFeature({...newFeature, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-fog-accent transition-colors"/></div>
                     <div className="space-y-2"><label className="text-sm text-white/60 font-medium ml-1">Description</label><textarea placeholder="Describe this feature..." value={newFeature.desc} onChange={(e) => setNewFeature({...newFeature, desc: e.target.value})} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-fog-accent resize-none transition-colors"/></div>
                  </div>
                  <div className="space-y-4">
                      <div className="flex gap-2 mb-2">
                          <button onClick={() => setInputType('upload')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${inputType === 'upload' ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'}`}>Upload Image</button>
                          <button onClick={() => setInputType('url')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${inputType === 'url' ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'}`}>Image URL</button>
                      </div>
                      <div className="h-full min-h-[200px] bg-black/40 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/30 transition-colors">
                          {newFeature.img ? (<><img src={newFeature.img} alt="Preview" className="w-full h-full object-cover" /><button onClick={() => setNewFeature({...newFeature, img: null})} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"><X className="w-4 h-4" /></button></>) : (inputType === 'upload' ? (<div className="text-center p-6"><ImageIcon className="w-8 h-8 text-white/20 mx-auto mb-2" /><span className="text-white/40 text-sm">Click to Upload</span></div>) : (<div className="w-full p-6 flex flex-col items-center gap-3"><ImageIcon className="w-8 h-8 text-white/20 mx-auto" /><input type="text" placeholder="Paste image URL here..." className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-fog-accent text-center" onChange={(e) => setNewFeature({...newFeature, img: e.target.value})}/></div>))}
                          {inputType === 'upload' && !newFeature.img && (<input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />)}
                      </div>
                  </div>
               </div>
               <div className="flex justify-end mt-6"><button onClick={handleAddFeature} disabled={!newFeature.title || !newFeature.desc || !newFeature.img} className="px-8 py-3 bg-status-present text-fog-base rounded-xl font-bold hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:scale-100">Save Feature</button></div>
            </div>
         )}
         <div className="flex flex-col gap-6 pb-12">
            {featuresList.map((item, index) => (
               <div key={item.id} className="group relative w-full p-8 rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 hover:border-white/20 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="flex items-start gap-8 relative z-10">
                      <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shrink-0 relative group/image cursor-pointer transform transition-transform duration-500 group-hover:scale-[1.02] bg-black/20">
                           <img src={item.img} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop'; }}/>
                           <label className="absolute inset-0 bg-black/40 backdrop-blur-[4px] flex flex-col items-center justify-center opacity-0 group-hover/image:opacity-100 transition-all duration-300">
                               <Upload className="w-6 h-6 text-white mb-2 drop-shadow-md" />
                               <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">Change</span>
                               <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpdateImage(item.id, e)}/>
                           </label>
                      </div>
                      <div className="flex-1 min-w-0 py-2">
                          <div className="flex items-start justify-between">
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight group-hover:text-fog-accent transition-colors duration-300">{item.title}</h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 bg-black/20 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                               <button onClick={() => handleMoveFeature(index, 'up')} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Move Up" disabled={index === 0}><ChevronUp className="w-4 h-4" /></button>
                               <button onClick={() => handleMoveFeature(index, 'down')} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Move Down" disabled={index === featuresList.length - 1}><ChevronDown className="w-4 h-4" /></button>
                               <div className="w-px h-4 bg-white/20 mx-1"></div>
                               <button onClick={() => handleDeleteFeature(item.id)} className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Feature"><Trash2 className="w-4 h-4" /></button>
                           </div>
                          </div>
                           <div className="w-12 h-1.5 bg-white/10 rounded-full group-hover:w-24 group-hover:bg-fog-accent transition-all duration-500 ease-out mb-4" />
                           <p className="text-lg text-white/60 leading-relaxed font-light">{item.desc}</p>
                      </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    );

  return (
    <Layout currentView={view} onChangeView={setView}>
      {view === 'dashboard' && renderDashboard()}
      {view === 'create-reference' && renderCreateReference()}
      {view === 'monitor' && renderMonitor()}
      {view === 'photo-compare' && renderPhotoCompare()}
      {view === 'features' && renderFeatures()}
    </Layout>
  );
};

export default App;