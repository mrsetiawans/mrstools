import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, PictureInPicture,
    Clock, List, Repeat, ChevronLeft, ChevronRight, Settings, Check,
    Captions, X, Sun, Moon, Film, Trash2, History, Plus, GripVertical,
    RectangleHorizontal, MonitorPlay, XCircle
} from 'lucide-react';

// === Custom Hook: useLocalStorage ===
// Menggantikan Firestore untuk kompatibilitas web statis (GitHub Pages)
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
}

// === Konteks untuk Notifikasi ===
const ToastContext = createContext(() => {});

function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timeoutRef = useRef(null);

    const showToast = useCallback((message, icon = null, duration = 2000) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setToast({ message, icon });
        timeoutRef.current = setTimeout(() => {
            setToast(null);
        }, duration);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99999] bg-gray-900/80 dark:bg-black/80 text-white px-5 py-3 rounded-lg shadow-xl backdrop-blur-sm flex items-center gap-3 animate-toast-in">
                    {toast.icon}
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            )}
        </ToastContext.Provider>
    );
}

const useToast = () => useContext(ToastContext);

// === Komponen Helper: ProgressBar ===
function ProgressBar({ currentTime, duration, onSeek, bufferedTime, isSeeking, onSeekStart, onSeekEnd, onSeekPreview }) {
    const progressRef = useRef(null);

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds)) return '00:00';
        const date = new Date(null);
        date.setSeconds(timeInSeconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    };

    const handleSeekInteraction = (e) => {
        if (!progressRef.current || duration === 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        let percentage = (clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage));
        return percentage;
    };

    const handleMouseMove = (e) => {
        if (!isSeeking) return;
        const percentage = handleSeekInteraction(e);
        onSeek(percentage * duration, false);
    };

    const handleTouchMove = (e) => {
        if (!isSeeking) return;
        const percentage = handleSeekInteraction(e);
        onSeek(percentage * duration, false);
    };

    const handleMouseDown = (e) => {
        onSeekStart();
        const percentage = handleSeekInteraction(e);
        onSeek(percentage * duration, true);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleMouseUp);
    };

    const handleMouseUp = () => {
        onSeekEnd();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
    };

    const handlePreview = (e) => {
        if (!progressRef.current || duration === 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const previewTime = formatTime(percentage * duration);
        onSeekPreview(previewTime, e.clientX - rect.left);
    };

    const playedPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPercentage = duration > 0 ? (bufferedTime / duration) * 100 : 0;

    return (
        <div
            ref={progressRef}
            className="relative w-full h-2 bg-white/20 hover:h-3 rounded-full cursor-pointer transition-all duration-200 group"
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onMouseMove={handlePreview}
            onMouseLeave={() => onSeekPreview(null, 0)}
        >
            {/* Buffer progress */}
            <div
                className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-100"
                style={{ width: `${bufferedPercentage}%` }}
            />
            {/* Play progress */}
            <div
                className="absolute top-0 left-0 h-full bg-cyan-500 rounded-full"
                style={{ width: `${playedPercentage}%` }}
            >
                {/* Seek handle */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );
}

// === Komponen Helper: PlayerControls ===
function PlayerControls({
    playerState,
    handlers,
    duration,
    bufferedTime,
    isTheaterMode,
    toggleTheaterMode,
    availableSubtitles,
    activeSubtitle,
    onSubtitleChange,
    seekPreview,
}) {
    const { isPlaying, isMuted, volume, playbackRate, isLooping, isFullscreen } = playerState;
    const {
        togglePlay, toggleMute, setVolume, setPlaybackRate, toggleLoop,
        toggleFullscreen, skip, onSeek, onSeekStart, onSeekEnd
    } = handlers;

    const [showVolume, setShowVolume] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const settingsTimeoutRef = useRef(null);
    const volumeTimeoutRef = useRef(null);

    const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds)) return '00:00';
        const date = new Date(null);
        date.setSeconds(timeInSeconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    };

    const VolumeIcon = isMuted || volume === 0 ? VolumeX : Volume2;
    const FullscreenIcon = isFullscreen ? Minimize : Maximize;

    const handleSettingsEnter = () => {
        if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
        setShowSettings(true);
    };
    const handleSettingsLeave = () => {
        settingsTimeoutRef.current = setTimeout(() => setShowSettings(false), 200);
    };

    const handleVolumeEnter = () => {
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        setShowVolume(true);
    };
    const handleVolumeLeave = () => {
        volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 200);
    };

    return (
        <div
            className="absolute bottom-0 left-0 right-0 z-20 p-4 pt-2 text-white bg-gradient-to-t from-black/80 to-transparent transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Seek Preview Tooltip */}
            {seekPreview.time && (
                <div
                    className="absolute bottom-12 px-2 py-1 bg-black/80 text-white text-xs rounded"
                    style={{ left: `${seekPreview.position}px`, transform: 'translateX(-50%)' }}
                >
                    {seekPreview.time}
                </div>
            )}
            
            {/* Progress Bar */}
            <ProgressBar
                currentTime={playerState.currentTime}
                duration={duration}
                bufferedTime={bufferedTime}
                onSeek={onSeek}
                isSeeking={playerState.isSeeking}
                onSeekStart={onSeekStart}
                onSeekEnd={onSeekEnd}
                onSeekPreview={handlers.setSeekPreview}
            />

            {/* Bottom Controls Row */}
            <div className="flex justify-between items-center gap-4">
                {/* Left Controls */}
                <div className="flex items-center gap-3">
                    <button onClick={() => skip(-5)} className="hover:text-cyan-400 transition-colors"><ChevronLeft size={22} /></button>
                    <button onClick={togglePlay} className="hover:text-cyan-400 transition-colors">
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <button onClick={() => skip(5)} className="hover:text-cyan-400 transition-colors"><ChevronRight size={22} /></button>
                    
                    <div className="flex items-center gap-2" onMouseEnter={handleVolumeEnter} onMouseLeave={handleVolumeLeave}>
                        <button onClick={toggleMute} className="hover:text-cyan-400 transition-colors">
                            <VolumeIcon size={22} />
                        </button>
                        <div className={`transition-all duration-300 ease-in-out ${showVolume ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={setVolume}
                                className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
                            />
                        </div>
                    </div>
                    <div className="text-sm font-mono hidden sm:block">
                        {formatTime(playerState.currentTime)} / {formatTime(duration)}
                    </div>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                    <button onClick={toggleLoop} className={`hover:text-cyan-400 transition-colors ${isLooping ? 'text-cyan-500' : ''}`} title="Loop">
                        <Repeat size={20} />
                    </button>

                    <div className="relative" onMouseEnter={handleSettingsEnter} onMouseLeave={handleSettingsLeave}>
                        <button className="hover:text-cyan-400 transition-colors" title="Pengaturan">
                            <Settings size={20} />
                        </button>
                        {/* Settings Menu Popup */}
                        {showSettings && (
                            <div className="absolute bottom-full right-0 mb-3 w-40 bg-gray-900/90 backdrop-blur-md rounded-lg shadow-xl overflow-hidden animate-fade-in-up">
                                {/* Playback Speed */}
                                <div className="p-2">
                                    <div className="text-xs text-gray-400 px-2 mb-1">Kecepatan</div>
                                    {playbackRates.map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => setPlaybackRate(rate)}
                                            className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-white/10 ${playbackRate === rate ? 'text-cyan-400' : ''}`}
                                        >
                                            {rate === 1 ? 'Normal' : `${rate}x`}
                                            {playbackRate === rate && <Check size={16} className="inline ml-2" />}
                                        </button>
                                    ))}
                                </div>
                                {/* Subtitles */}
                                {availableSubtitles.length > 0 && (
                                    <>
                                        <div className="h-px bg-white/10" />
                                        <div className="p-2">
                                            <div className="text-xs text-gray-400 px-2 mb-1">Subtitle</div>
                                            <button
                                                onClick={() => onSubtitleChange(null)}
                                                className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-white/10 ${!activeSubtitle ? 'text-cyan-400' : ''}`}
                                            >
                                                Nonaktif
                                                {!activeSubtitle && <Check size={16} className="inline ml-2" />}
                                            </button>
                                            {availableSubtitles.map(track => (
                                                <button
                                                    key={track.lang}
                                                    onClick={() => onSubtitleChange(track.lang)}
                                                    className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-white/10 ${activeSubtitle === track.lang ? 'text-cyan-400' : ''}`}
                                                >
                                                    {track.label}
                                                    {activeSubtitle === track.lang && <Check size={16} className="inline ml-2" />}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {availableSubtitles.length > 0 && (
                         <button onClick={() => onSubtitleChange(activeSubtitle ? null : availableSubtitles[0].lang)} className={`hover:text-cyan-400 transition-colors ${activeSubtitle ? 'text-cyan-500' : ''}`} title="Subtitle">
                            <Captions size={20} />
                        </button>
                    )}

                    <button onClick={toggleTheaterMode} className={`hover:text-cyan-400 transition-colors ${isTheaterMode ? 'text-cyan-500' : ''}`} title="Mode Teater">
                        {isTheaterMode ? <MonitorPlay size={20} /> : <RectangleHorizontal size={20} />}
                    </button>

                    <button onClick={handlers.togglePiP} className="hover:text-cyan-400 transition-colors" title="Picture-in-Picture">
                        <PictureInPicture size={20} />
                    </button>

                    <button onClick={toggleFullscreen} className="hover:text-cyan-400 transition-colors" title="Fullscreen">
                        <FullscreenIcon size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// === Komponen Utama: PlayerWrapper ===
function PlayerWrapper({ videoItem, onEnded, onLoadedData, onTimeUpdate, onVideoError }) {
    const { videoUrl, subtitleUrl, title } = videoItem;
    const videoRef = useRef(null);
    const playerWrapperRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const showToast = useToast();

    const [playerState, setPlayerState] = useState({
        isPlaying: false,
        isMuted: false,
        volume: 1,
        playbackRate: 1,
        isLooping: false,
        isFullscreen: false,
        isSeeking: false,
        currentTime: 0,
    });
    const [duration, setDuration] = useState(0);
    const [bufferedTime, setBufferedTime] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [availableSubtitles, setAvailableSubtitles] = useState([]);
    const [activeSubtitle, setActiveSubtitle] = useState(null);
    const [seekPreview, setSeekPreview] = useState({ time: null, position: 0 });

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds)) return '00:00';
        const date = new Date(null);
        date.setSeconds(timeInSeconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    };

    const updatePlayerState = (key, value) => {
        setPlayerState(prev => ({ ...prev, [key]: value }));
    };

    // --- Kontrol Visibilitas ---
    const showControls = useCallback(() => {
        setIsControlsVisible(true);
        document.body.style.cursor = 'default';
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        if (playerState.isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setIsControlsVisible(false);
                document.body.style.cursor = 'none';
            }, 3000);
        }
    }, [playerState.isPlaying]);

    useEffect(() => {
        showControls(); // Tampilkan kontrol saat play/pause
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [playerState.isPlaying, showControls]);

    useEffect(() => {
        const wrapper = playerWrapperRef.current;
        wrapper.addEventListener('mousemove', showControls);
        wrapper.addEventListener('mouseleave', () => {
             if (playerState.isPlaying) {
                setIsControlsVisible(false);
                document.body.style.cursor = 'none';
             }
        });
        return () => {
            wrapper.removeEventListener('mousemove', showControls);
            document.body.style.cursor = 'default';
        };
    }, [showControls, playerState.isPlaying]);


    // --- Penangan Event Video ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => updatePlayerState('isPlaying', true);
        const handlePause = () => updatePlayerState('isPlaying', false);
        const handleVolumeChange = () => {
            updatePlayerState('isMuted', video.muted);
            updatePlayerState('volume', video.volume);
        };
        const handleRateChange = () => updatePlayerState('playbackRate', video.playbackRate);
        const handleTimeUpdate = () => {
            if (!playerState.isSeeking) {
                updatePlayerState('currentTime', video.currentTime);
                onTimeUpdate(video.currentTime, duration);
            }
        };
        const handleDurationChange = () => setDuration(video.duration);
        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            onLoadedData({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
            // Cek subtitles bawaan
            const tracks = Array.from(video.textTracks || []).map(track => ({
                lang: track.language,
                label: track.label || track.language,
                mode: track.mode
            }));
            setAvailableSubtitles(tracks);
            if(tracks.length > 0) {
                // Sembunyikan semua trek bawaan, kita akan kelola manual
                tracks.forEach(t => video.textTracks[t.lang].mode = 'hidden');
            }
        };
        const handleProgress = () => {
            if (video.buffered.length > 0) {
                setBufferedTime(video.buffered.end(video.buffered.length - 1));
            }
        };
        const handleWaiting = () => setIsLoading(true);
        const handlePlaying = () => setIsLoading(false);
        const handleError = (e) => {
            setIsLoading(false);
            console.error("Video Error:", e);
            onVideoError("Gagal memuat video. Periksa URL atau koneksi Anda.");
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('ratechange', handleRateChange);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', onEnded);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('ratechange', handleRateChange);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('error', handleError);
        };
    }, [onEnded, onLoadedData, onTimeUpdate, playerState.isSeeking, onVideoError]);
    
    // --- Efek untuk memuat video baru ---
    useEffect(() => {
        if (!videoRef.current) return;
        setIsLoading(true);
        videoRef.current.load();
        videoRef.current.play().catch(e => {
            console.warn("Autoplay diblokir, perlu interaksi pengguna.", e);
            updatePlayerState('isPlaying', false);
            setIsLoading(false);
        });
        
        // Setup subtitles
        const video = videoRef.current;
        // Hapus track lama
        const oldTracks = video.querySelectorAll('track');
        oldTracks.forEach(track => video.removeChild(track));

        const allTracks = [];

        // Tambah track dari file .vtt eksternal
        if (subtitleUrl) {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = 'Eksternal';
            track.srclang = 'ext';
            track.src = subtitleUrl;
            track.mode = 'hidden'; // Mulai tersembunyi
            video.appendChild(track);
            allTracks.push({ lang: 'ext', label: 'Eksternal' });
        }
        
        // Tambahkan track bawaan (jika ada, setelah metadata dimuat)
        const checkBuiltInTracks = () => {
            const builtInTracks = Array.from(video.textTracks || [])
                .filter(t => t.kind === 'subtitles')
                .map(track => ({
                    lang: track.language,
                    label: track.label || track.language,
                }));
            
            // Gabungkan dan hilangkan duplikat
            const finalTracks = [...allTracks, ...builtInTracks].filter((track, index, self) =>
                index === self.findIndex((t) => (
                    t.lang === track.lang && t.label === track.label
                ))
            );
            
            setAvailableSubtitles(finalTracks);
            // Sembunyikan semua trek secara default
            Array.from(video.textTracks).forEach(track => track.mode = 'hidden');

            if(finalTracks.length > 0) {
                // Coba aktifkan subtitle pertama jika ada
                video.textTracks[finalTracks[0].lang].mode = 'showing';
                setActiveSubtitle(finalTracks[0].lang);
            } else {
                setActiveSubtitle(null);
            }
        };

        video.addEventListener('loadedmetadata', checkBuiltInTracks, { once: true });

        return () => {
             video.removeEventListener('loadedmetadata', checkBuiltInTracks);
        }

    }, [videoUrl, subtitleUrl]);

    // --- Penangan Kontrol ---
    const togglePlay = useCallback(() => {
        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    }, []);

    const toggleMute = useCallback(() => {
        videoRef.current.muted = !videoRef.current.muted;
        showToast(videoRef.current.muted ? "Mute" : "Unmute", videoRef.current.muted ? <VolumeX size={20} /> : <Volume2 size={20} />);
    }, [showToast]);

    const setVolume = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
    }, []);

    const setPlaybackRate = useCallback((rate) => {
        videoRef.current.playbackRate = rate;
        showToast(`Kecepatan ${rate}x`, <Settings size={20} />);
    }, [showToast]);

    const toggleLoop = useCallback(() => {
        const newLoop = !videoRef.current.loop;
        videoRef.current.loop = newLoop;
        updatePlayerState('isLooping', newLoop);
        showToast(newLoop ? "Loop Aktif" : "Loop Nonaktif", <Repeat size={20} />);
    }, [showToast]);

    const skip = useCallback((amount) => {
        videoRef.current.currentTime += amount;
        showToast(`${amount > 0 ? '+' : ''}${amount} detik`, amount > 0 ? <ChevronRight size={20} /> : <ChevronLeft size={20} />);
    }, [showToast]);

    const onSeek = useCallback((time, finalSeek = true) => {
        videoRef.current.currentTime = time;
        updatePlayerState('currentTime', time);
        if(finalSeek) {
            showToast(`Lompat ke ${formatTime(time)}`, <Clock size={20} />);
        }
    }, [showToast]);

    const onSeekStart = useCallback(() => updatePlayerState('isSeeking', true), []);
    const onSeekEnd = useCallback(() => updatePlayerState('isSeeking', false), []);

    const handleSetSeekPreview = (time, position) => {
        setSeekPreview({ time, position });
    };

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            playerWrapperRef.current.requestFullscreen();
            updatePlayerState('isFullscreen', true);
        } else {
            document.exitFullscreen();
            updatePlayerState('isFullscreen', false);
        }
    }, []);
    
    useEffect(() => {
        const handleFullscreenChange = () => {
            updatePlayerState('isFullscreen', !!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const togglePiP = useCallback(async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (err) {
            console.error(err);
            showToast("Gagal masuk mode PiP", <XCircle size={20} />);
        }
    }, [showToast]);

    const toggleTheaterMode = useCallback(() => {
        setIsTheaterMode(prev => {
            const newMode = !prev;
            showToast(newMode ? "Mode Teater Aktif" : "Mode Teater Nonaktif", newMode ? <MonitorPlay size={20} /> : <RectangleHorizontal size={20} />);
            return newMode;
        });
    }, [showToast]);

    const handleSubtitleChange = useCallback((lang) => {
        const video = videoRef.current;
        if (!video) return;

        Array.from(video.textTracks).forEach(track => {
            track.mode = track.language === lang ? 'showing' : 'hidden';
        });

        setActiveSubtitle(lang);
        showToast(lang ? `Subtitle (${lang}) Aktif` : "Subtitle Nonaktif", <Captions size={20} />);
    }, [showToast]);

    // --- Pintasan Keyboard ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Jangan aktifkan shortcut jika sedang mengetik di input
            if (e.target.tagName === 'INPUT') return;

            // Pindahkan logika angka 0-9 ke sini SEBELUM switch
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                const number = parseInt(e.key);
                const percentage = number * 10; // 0 -> 0%, 9 -> 90%
                if (duration > 0) {
                    const time = (duration / 100) * percentage;
                    onSeek(time);
                }
                return; // Keluar dari fungsi
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'p':
                    e.preventDefault();
                    togglePiP();
                    break;
                case 't':
                    e.preventDefault();
                    toggleTheaterMode();
                    break;
                case 'l':
                case 'arrowright':
                    e.preventDefault();
                    skip(5);
                    break;
                case 'j':
                case 'arrowleft':
                    e.preventDefault();
                    skip(-5);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    const newVolUp = Math.min(videoRef.current.volume + 0.1, 1);
                    videoRef.current.volume = newVolUp;
                    videoRef.current.muted = false;
                    showToast(`Volume ${Math.round(newVolUp * 100)}%`, <Volume2 size={20} />);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    const newVolDown = Math.max(videoRef.current.volume - 0.1, 0);
                    videoRef.current.volume = newVolDown;
                    videoRef.current.muted = newVolDown === 0;
                    showToast(`Volume ${Math.round(newVolDown * 100)}%`, newVolDown === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />);
                    break;
                // Angka 0-9 untuk lompat
                // ... Hapus blok yang salah dari sini ...
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, toggleMute, toggleFullscreen, togglePiP, toggleTheaterMode, skip, duration, onSeek, showToast]);

    const handlers = {
        togglePlay, toggleMute, setVolume, setPlaybackRate, toggleLoop,
        toggleFullscreen, togglePiP, skip, onSeek, onSeekStart, onSeekEnd,
        setSeekPreview: handleSetSeekPreview,
    };

    return (
        <div 
            ref={playerWrapperRef} 
            className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${isTheaterMode ? 'w-full max-w-full !aspect-auto h-[90vh]' : 'max-w-5xl'}`}
            style={{ cursor: isControlsVisible ? 'default' : 'none' }}
            onClick={!isControlsVisible ? showControls : undefined}
        >
            {/* Judul Video */}
            {title && isControlsVisible && (
                <div className="absolute top-0 left-0 right-0 z-20 p-4 text-white bg-gradient-to-b from-black/60 to-transparent">
                    <h1 className="text-lg font-semibold truncate">{title}</h1>
                </div>
            )}

            {/* Video Element */}
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                playsInline
            />

            {/* Overlay Tengah */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                {/* Loading Spinner */}
                {isLoading && (
                    <div className="w-16 h-16 border-4 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
                )}
                {/* Tombol Play/Pause Besar (saat dijeda) */}
                {!isPlaying && !isLoading && (
                    <button
                        onClick={togglePlay}
                        className="p-4 bg-black/50 rounded-full text-white hover:bg-cyan-500/80 transition-all duration-300 scale-150 pointer-events-auto"
                        aria-label="Play"
                    >
                        <Play size={40} className="ml-1" />
                    </button>
                )}
            </div>
            
            {/* Kontrol Kustom */}
            <div className={`absolute inset-0 z-10 transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                <PlayerControls
                    playerState={playerState}
                    handlers={handlers}
                    duration={duration}
                    bufferedTime={bufferedTime}
                    isTheaterMode={isTheaterMode}
                    toggleTheaterMode={toggleTheaterMode}
                    availableSubtitles={availableSubtitles}
                    activeSubtitle={activeSubtitle}
                    onSubtitleChange={handleSubtitleChange}
                    seekPreview={seekPreview}
                />
            </div>
        </div>
    );
}

// === Komponen Panel: Playlist ===
function PlaylistPanel({ playlist, onPlayItem, onRemoveItem, onAddItem, onClearPlaylist, currentVideoUrl }) {
    const [newItemUrl, setNewItemUrl] = useState('');
    const [newItemSubtitleUrl, setNewItemSubtitleUrl] = useState('');
    const [newItemTitle, setNewItemTitle] = useState('');
    const showToast = useToast();

    const handleAddItem = (e) => {
        e.preventDefault();
        if (!newItemUrl) {
            showToast("URL Video tidak boleh kosong", <XCircle size={20} />);
            return;
        }
        onAddItem({
            url: newItemUrl,
            subtitleUrl: newItemSubtitleUrl,
            title: newItemTitle || "Video Tanpa Judul"
        });
        setNewItemUrl('');
        setNewItemSubtitleUrl('');
        setNewItemTitle('');
        showToast("Video ditambahkan ke antrean", <Plus size={20} />);
    };
    
    const getYouTubeTitle = async (url) => {
        // Fitur ini memerlukan backend/server proxy untuk menghindari CORS,
        // jadi kita akan gunakan placeholder untuk saat ini.
        return "Video (Judul Otomatis Dinonaktifkan)";
    };

    const handleUrlPaste = async (e) => {
        const pastedUrl = e.clipboardData.getData('text');
        setNewItemUrl(pastedUrl);
        // Coba ambil judul jika URL YouTube (dinonaktifkan untuk statis)
        // if (pastedUrl.includes("youtube.com") || pastedUrl.includes("youtu.be")) {
        //     const title = await getYouTubeTitle(pastedUrl);
        //     setNewItemTitle(title);
        // }
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold mb-4">Daftar Putar</h2>
            {/* Form Tambah Video */}
            <form onSubmit={handleAddItem} className="mb-4 space-y-3">
                <input
                    type="text"
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                    onPaste={handleUrlPaste}
                    placeholder="Masukkan URL Video..."
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                />
                <input
                    type="text"
                    value={newItemSubtitleUrl}
                    onChange={(e) => setNewItemSubtitleUrl(e.target.value)}
                    placeholder="URL Subtitle (.vtt) (Opsional)"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                />
                <input
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="Judul Video (Opsional)"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                />
                <button type="submit" className="w-full bg-cyan-500 text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-cyan-600 transition-colors">
                    <Plus size={16} className="inline mr-1" /> Tambah ke Antrean
                </button>
            </form>

            {/* Daftar Video */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {playlist.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Daftar putar kosong.</p>
                )}
                {playlist.map((item, index) => (
                    <div
                        key={item.id} // Asumsi item punya ID unik
                        className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${currentVideoUrl === item.url ? 'bg-cyan-100 dark:bg-cyan-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                        onClick={() => onPlayItem(item)}
                    >
                        <GripVertical size={16} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.url}</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveItem(item.id);
                            }}
                            className="p-1 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/50 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Hapus"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
            {playlist.length > 0 && (
                <button 
                    onClick={onClearPlaylist} 
                    className="w-full mt-4 bg-red-500 text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-red-600 transition-colors"
                >
                    <Trash2 size={16} className="inline mr-1" /> Bersihkan Daftar Putar
                </button>
            )}
        </div>
    );
}

// === Komponen Panel: History ===
function HistoryPanel({ history, onPlayItem, onClearHistory }) {
    const formatTime = (timeInSeconds) => {
        if (!timeInSeconds || isNaN(timeInSeconds)) return '00:00';
        const date = new Date(null);
        date.setSeconds(timeInSeconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold mb-4">Riwayat Tontonan</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {history.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Belum ada riwayat.</p>
                )}
                {history.map(item => (
                    <div
                        key={item.id}
                        className="group flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        onClick={() => onPlayItem(item)}
                    >
                        <Film size={20} className="text-cyan-500 flex-shrink-0" />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Terakhir ditonton: {formatTime(item.lastTimestamp)}
                            </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                    </div>
                ))}
            </div>
             {history.length > 0 && (
                <button 
                    onClick={onClearHistory} 
                    className="w-full mt-4 bg-red-500 text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-red-600 transition-colors"
                >
                    <Trash2 size={16} className="inline mr-1" /> Bersihkan Riwayat
                </button>
            )}
        </div>
    );
}

// === Komponen Utama: App ===
export default function App() {
    const [isDark, setIsDark] = useLocalStorage('proPlayerV2:isDark', true);
    const [playlist, setPlaylist] = useLocalStorage('proPlayerV2:playlist', []);
    const [history, setHistory] = useLocalStorage('proPlayerV2:history', []);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [sidebarTab, setSidebarTab] = useState('playlist'); // 'playlist' or 'history'
    const [globalError, setGlobalError] = useState('');

    const showToast = useToast();

    // Terapkan Dark Mode
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.toggle('dark', isDark);
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);
    const ThemeIcon = isDark ? Sun : Moon;

    // --- Penangan Video ---
    const playVideo = (videoItem) => {
        // Buat salinan untuk menghindari mutasi state
        const itemToPlay = { ...videoItem };
        setCurrentVideo(itemToPlay);
        setGlobalError('');
        
        // Tambah/Update Riwayat
        setHistory(prevHistory => {
            const existingIndex = prevHistory.findIndex(item => item.url === itemToPlay.url);
            let newHistory = [...prevHistory];
            const historyItem = {
                id: existingIndex > -1 ? newHistory[existingIndex].id : crypto.randomUUID(),
                url: itemToPlay.url,
                subtitleUrl: itemToPlay.subtitleUrl,
                title: itemToPlay.title,
                lastTimestamp: existingIndex > -1 ? newHistory[existingIndex].lastTimestamp : 0,
                playedAt: new Date().toISOString()
            };

            if (existingIndex > -1) {
                newHistory.splice(existingIndex, 1);
            }
            newHistory.unshift(historyItem);
            
            // Batasi riwayat
            if (newHistory.length > 20) {
                newHistory = newHistory.slice(0, 20);
            }
            return newHistory;
        });
    };

    const handleVideoEnd = () => {
        if (!currentVideo) return;

        const currentIndex = playlist.findIndex(item => item.url === currentVideo.url);
        if (currentIndex > -1 && currentIndex < playlist.length - 1) {
            // Putar video berikutnya di playlist
            const nextVideo = playlist[currentIndex + 1];
            playVideo(nextVideo);
            showToast(`Memutar berikutnya: ${nextVideo.title}`, <Play size={20} />);
        } else {
            showToast("Daftar putar selesai", <Check size={20} />);
        }
    };

    const handleTimeUpdate = (currentTime, duration) => {
        if (!currentVideo || duration === 0) return;
        
        // Update riwayat (throttle?) - untuk sekarang, update langsung
        setHistory(prevHistory => {
            const existingIndex = prevHistory.findIndex(item => item.url === currentVideo.url);
            if (existingIndex > -1) {
                const newHistory = [...prevHistory];
                // Update timestamp hanya jika perbedaan cukup signifikan (misal > 5 detik)
                // Ini mencegah penulisan localStorage berlebihan.
                // Untuk kesederhanaan, kita akan update timestamp-nya.
                if (Math.abs(newHistory[existingIndex].lastTimestamp - currentTime) > 5) {
                     newHistory[existingIndex].lastTimestamp = currentTime;
                     return newHistory;
                }
            }
            return prevHistory;
        });
    };

    // --- Penangan Playlist ---
    const addPlaylistItem = (item) => {
        const newItem = { ...item, id: crypto.randomUUID() };
        setPlaylist(prev => [...prev, newItem]);
        if (!currentVideo) {
            playVideo(newItem);
        }
    };

    const removePlaylistItem = (id) => {
        setPlaylist(prev => prev.filter(item => item.id !== id));
        showToast("Video dihapus dari antrean", <Trash2 size={20} />);
    };

    const clearPlaylist = () => {
        setPlaylist([]);
        showToast("Daftar putar dibersihkan", <Trash2 size={20} />);
    };
    
    // --- Penangan Riwayat ---
    const playFromHistory = (item) => {
         // Cek apakah video masih ada di playlist
        const inPlaylist = playlist.find(p => p.url === item.url);
        if (inPlaylist) {
            playVideo(inPlaylist);
        } else {
            // Putar sebagai video tunggal
            playVideo(item);
        }
        
        // Tampilkan notifikasi untuk melanjutkan
        if (item.lastTimestamp && item.lastTimestamp > 5) {
             const time = new Date(null);
             time.setSeconds(item.lastTimestamp);
             const timeString = time.toISOString().substr(11, 8);
             showToast(`Melanjutkan dari ${timeString.startsWith('00:') ? timeString.substr(3) : timeString}`, <History size={20} />);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        showToast("Riwayat dibersihkan", <Trash2 size={20} />);
    };

    // --- Penangan Input Utama ---
    const handleMainUrlSubmit = (e) => {
        e.preventDefault();
        const url = e.target.videoUrl.value;
        const subUrl = e.target.subtitleUrl.value;
        if (!url) return;
        
        const title = "Video dari URL";
        const newItem = {
            id: crypto.randomUUID(),
            url,
            subtitleUrl: subUrl,
            title
        };
        
        // Tambah ke playlist DAN langsung mainkan
        setPlaylist(prev => [newItem, ...prev.filter(p => p.url !== url)]);
        playVideo(newItem);
        
        // Kosongkan input
        e.target.videoUrl.value = '';
        e.target.subtitleUrl.value = '';
    };

    return (
        <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter transition-colors duration-300 ${currentVideo ? 'pb-24 lg:pb-0' : ''}`}>
            <header className="py-4 px-6 lg:px-10 flex justify-between items-center shadow-sm dark:bg-gray-800/50">
                <h1 className="text-xl lg:text-2xl font-bold text-cyan-500 flex items-center gap-2">
                    <MonitorPlay size={28} />
                    Pro-Player v2
                </h1>
                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Ganti Tema">
                    <ThemeIcon size={22} />
                </button>
            </header>

            <main className="w-full max-w-[1600px] mx-auto p-4 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                    
                    {/* Kolom Kiri: Player & Input */}
                    <div className="flex flex-col gap-6 items-center">
                        {globalError && (
                            <div className="w-full p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm">
                                {globalError}
                            </div>
                        )}
                        
                        {!currentVideo && (
                             <div className="w-full max-w-5xl aspect-video bg-black rounded-xl shadow-2xl flex flex-col items-center justify-center text-gray-400">
                                <Film size={60} />
                                <p className="mt-2 text-lg">Pemutar Video Siap</p>
                                <p className="text-sm">Masukkan URL di bawah atau pilih dari daftar putar.</p>
                            </div>
                        )}
                        
                        {currentVideo && (
                            <PlayerWrapper
                                key={currentVideo.url} // Ganti video saat URL berubah
                                videoItem={currentVideo}
                                onEnded={handleVideoEnd}
                                onLoadedData={() => {}}
                                onTimeUpdate={handleTimeUpdate}
                                onVideoError={setGlobalError}
                            />
                        )}

                        {/* Input Utama (hanya tampil jika tidak ada video) */}
                        {!currentVideo && (
                            <form onSubmit={handleMainUrlSubmit} className="w-full max-w-3xl p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-3">
                                <h3 className="text-lg font-semibold">Mulai Memutar</h3>
                                <input
                                    name="videoUrl"
                                    type="text"
                                    placeholder="Masukkan URL Video..."
                                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
                                    required
                                />
                                <input
                                    name="subtitleUrl"
                                    type="text"
                                    placeholder="URL Subtitle (.vtt) (Opsional)"
                                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
                                />
                                <button type="submit" className="w-full bg-cyan-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-cyan-600 transition-colors">
                                    <Play size={18} className="inline mr-2" /> Putar Video
                                </button>
                            </form>
                        )}
                    </div>
                    
                    {/* Kolom Kanan: Sidebar */}
                    <aside className="h-full lg:h-[85vh] bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 flex flex-col">
                        {/* Tab Buttons */}
                        <div className="flex mb-4 border-b border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setSidebarTab('playlist')}
                                className={`flex-1 py-2 text-sm font-medium ${sidebarTab === 'playlist' ? 'text-cyan-500 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <List size={16} className="inline mr-1" /> Daftar Putar ({playlist.length})
                            </button>
                            <button
                                onClick={() => setSidebarTab('history')}
                                className={`flex-1 py-2 text-sm font-medium ${sidebarTab === 'history' ? 'text-cyan-500 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <History size={16} className="inline mr-1" /> Riwayat ({history.length})
                            </button>
                        </div>
                        
                        {/* Tab Content */}
                        <div className="flex-1 overflow-hidden h-full">
                            {sidebarTab === 'playlist' && (
                                <PlaylistPanel
                                    playlist={playlist}
                                    onPlayItem={playVideo}
                                    onRemoveItem={removePlaylistItem}
                                    onAddItem={addPlaylistItem}
                                    onClearPlaylist={clearPlaylist}
                                    currentVideoUrl={currentVideo?.url}
                                />
                            )}
                            {sidebarTab === 'history' && (
                                <HistoryPanel
                                    history={history}
                                    onPlayItem={playFromHistory}
                                    onClearHistory={clearHistory}
                                />
                            )}
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

// === Root Provider Wrapper (jika diperlukan, tapi untuk 1 file kita bungkus di App) ===
// Kita akan membungkus App dengan ToastProvider

// Ekspor default harus berupa komponen React
const AppWithProviders = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);

// Karena aturan satu file, kita akan ekspor App langsung dan membungkusnya di root
// Namun, untuk kesederhanaan, mari kita gabungkan ToastProvider ke dalam App.

// Versi Final (Gabungkan Provider ke App)
export default function ProPlayerApp() {
    return (
        <ToastProvider>
            <App />
        </ToastProvider>
    );
}

// Tailwind CSS butuh ini untuk deteksi class
// (Catatan: Ini hanya komentar, tapi penting untuk diketahui)
// className="animate-toast-in animate-fade-in-up"
// (Definisi animasi di <style> tag jika diperlukan, tapi Tailwind 3+ JIT harusnya OK)
// Mari tambahkan keyframes untuk memastikan
const style = document.createElement('style');
style.innerHTML = `
    @keyframes toast-in {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
    .animate-toast-in {
        animation: toast-in 0.3s ease-out;
    }
    @keyframes fade-in-up {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
        animation: fade-in-up 0.2s ease-out;
    }
    
    /* Custom scrollbar untuk sidebar */
    aside .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
    }
    aside .overflow-y-auto::-webkit-scrollbar-track {
        background: transparent;
    }
    aside .overflow-y-auto::-webkit-scrollbar-thumb {
        background: #94a3b8; /* gray-400 */
        border-radius: 3px;
    }
    html.dark aside .overflow-y-auto::-webkit-scrollbar-thumb {
        background: #475569; /* gray-600 */
    }
`;
document.head.appendChild(style);

