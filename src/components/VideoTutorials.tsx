'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Globe, ChevronRight, Clock, Award, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Tutorial content in multiple languages
const TUTORIALS = {
  en: {
    language: 'English',
    flag: '🇺🇸',
    categories: [
      {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Sparkles,
        videos: [
          {
            id: 'welcome',
            title: 'Welcome to Seoul Sister',
            duration: '2:30',
            thumbnail: '/tutorials/welcome-en.jpg',
            videoUrl: '/tutorials/welcome-en.mp4',
            description: 'Your journey to intelligent beauty shopping starts here',
            difficulty: 'Beginner',
            captions: true
          },
          {
            id: 'profile-setup',
            title: 'Setting Up Your Beauty Profile',
            duration: '3:15',
            thumbnail: '/tutorials/profile-en.jpg',
            videoUrl: '/tutorials/profile-en.mp4',
            description: 'Create your personalized beauty profile (optional)',
            difficulty: 'Beginner',
            captions: true
          },
          {
            id: 'ai-features',
            title: 'Using AI Intelligence Features',
            duration: '4:20',
            thumbnail: '/tutorials/ai-en.jpg',
            videoUrl: '/tutorials/ai-en.mp4',
            description: 'Discover how our AI saves you money',
            difficulty: 'Beginner',
            captions: true
          }
        ]
      },
      {
        id: 'advanced',
        title: 'Advanced Features',
        icon: Award,
        videos: [
          {
            id: 'price-tracking',
            title: 'Master Price Tracking',
            duration: '5:10',
            thumbnail: '/tutorials/price-en.jpg',
            videoUrl: '/tutorials/price-en.mp4',
            description: 'Find the best deals across all retailers',
            difficulty: 'Intermediate',
            captions: true
          },
          {
            id: 'skin-analysis',
            title: 'AI Skin Analysis Deep Dive',
            duration: '6:45',
            thumbnail: '/tutorials/skin-en.jpg',
            videoUrl: '/tutorials/skin-en.mp4',
            description: 'Get personalized recommendations',
            difficulty: 'Advanced',
            captions: true
          }
        ]
      }
    ]
  },
  ko: {
    language: '한국어',
    flag: '🇰🇷',
    categories: [
      {
        id: 'getting-started',
        title: '시작하기',
        icon: Sparkles,
        videos: [
          {
            id: 'welcome',
            title: '서울 시스터에 오신 것을 환영합니다',
            duration: '2:30',
            thumbnail: '/tutorials/welcome-ko.jpg',
            videoUrl: '/tutorials/welcome-ko.mp4',
            description: '지능형 뷰티 쇼핑의 시작',
            difficulty: '초급',
            captions: true
          },
          {
            id: 'profile-setup',
            title: '뷰티 프로필 설정',
            duration: '3:15',
            thumbnail: '/tutorials/profile-ko.jpg',
            videoUrl: '/tutorials/profile-ko.mp4',
            description: '개인 맞춤 프로필 만들기',
            difficulty: '초급',
            captions: true
          }
        ]
      }
    ]
  },
  es: {
    language: 'Español',
    flag: '🇪🇸',
    categories: [
      {
        id: 'getting-started',
        title: 'Empezando',
        icon: Sparkles,
        videos: [
          {
            id: 'welcome',
            title: 'Bienvenido a Seoul Sister',
            duration: '2:30',
            thumbnail: '/tutorials/welcome-es.jpg',
            videoUrl: '/tutorials/welcome-es.mp4',
            description: 'Tu viaje hacia las compras inteligentes de belleza',
            difficulty: 'Principiante',
            captions: true
          }
        ]
      }
    ]
  },
  zh: {
    language: '中文',
    flag: '🇨🇳',
    categories: [
      {
        id: 'getting-started',
        title: '入门指南',
        icon: Sparkles,
        videos: [
          {
            id: 'welcome',
            title: '欢迎来到首尔姐妹',
            duration: '2:30',
            thumbnail: '/tutorials/welcome-zh.jpg',
            videoUrl: '/tutorials/welcome-zh.mp4',
            description: '智能美妆购物之旅从这里开始',
            difficulty: '初级',
            captions: true
          }
        ]
      }
    ]
  },
  ar: {
    language: 'العربية',
    flag: '🇸🇦',
    categories: [
      {
        id: 'getting-started',
        title: 'البدء',
        icon: Sparkles,
        videos: [
          {
            id: 'welcome',
            title: 'مرحباً بك في سيول سيستر',
            duration: '2:30',
            thumbnail: '/tutorials/welcome-ar.jpg',
            videoUrl: '/tutorials/welcome-ar.mp4',
            description: 'رحلتك إلى التسوق الذكي للجمال تبدأ هنا',
            difficulty: 'مبتدئ',
            captions: true,
            rtl: true
          }
        ]
      }
    ]
  }
}

// Fallback video URLs (demo content)
const DEMO_VIDEO = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA3BtZGF0AAAA'

interface VideoTutorialsProps {
  defaultLanguage?: keyof typeof TUTORIALS
  onVideoComplete?: (videoId: string) => void
}

export default function VideoTutorials({
  defaultLanguage = 'en',
  onVideoComplete
}: VideoTutorialsProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof TUTORIALS>(defaultLanguage)
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState<typeof TUTORIALS['en']['categories'][0]['videos'][0] | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showCaptions, setShowCaptions] = useState(true)
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set())

  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const currentTutorials = TUTORIALS[selectedLanguage]

  // Handle video playback
  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  // Update progress
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateProgress = () => {
      const progress = (video.currentTime / video.duration) * 100
      setProgress(progress)
    }

    const handleEnd = () => {
      setIsPlaying(false)
      if (selectedVideo) {
        setWatchedVideos(prev => new Set(prev).add(selectedVideo.id))
        if (onVideoComplete) {
          onVideoComplete(selectedVideo.id)
        }
      }
    }

    video.addEventListener('timeupdate', updateProgress)
    video.addEventListener('ended', handleEnd)

    return () => {
      video.removeEventListener('timeupdate', updateProgress)
      video.removeEventListener('ended', handleEnd)
    }
  }, [selectedVideo, onVideoComplete])

  // Calculate completion percentage
  const calculateCompletion = () => {
    const totalVideos = currentTutorials.categories.reduce(
      (acc, cat) => acc + cat.videos.length,
      0
    )
    return Math.round((watchedVideos.size / totalVideos) * 100)
  }

  return (
    <div className="video-tutorials-container">
      {/* Language Selector */}
      <div className="language-selector">
        <Globe className="w-5 h-5 text-gold" />
        <div className="language-options">
          {Object.entries(TUTORIALS).map(([key, value]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedLanguage(key as keyof typeof TUTORIALS)
                setSelectedCategory(0)
                setSelectedVideo(null)
              }}
              className={`language-option ${selectedLanguage === key ? 'active' : ''}`}
            >
              <span className="flag">{value.flag}</span>
              <span className="language-name">{value.language}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="tutorials-layout">
        {/* Sidebar */}
        <aside className="tutorials-sidebar">
          <div className="progress-indicator">
            <div className="progress-ring">
              <svg width="80" height="80">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="#1E1E1E"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="#D4AF37"
                  strokeWidth="5"
                  fill="none"
                  strokeDasharray={`${calculateCompletion() * 2.2} 220`}
                  strokeDashoffset="0"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <span className="progress-text">{calculateCompletion()}%</span>
            </div>
            <p className="text-sm text-gold/60 mt-2">Progress</p>
          </div>

          {/* Categories */}
          <nav className="categories-nav">
            {currentTutorials.categories.map((category, index) => {
              const Icon = category.icon
              return (
                <motion.button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(index)
                    setSelectedVideo(null)
                  }}
                  className={`category-button ${selectedCategory === index ? 'active' : ''}`}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5" />
                  <span>{category.title}</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </motion.button>
              )
            })}
          </nav>
        </aside>

        {/* Video Area */}
        <main className="video-area">
          {selectedVideo ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="video-player"
            >
              <div className="video-wrapper">
                <video
                  ref={videoRef}
                  src={selectedVideo.videoUrl || DEMO_VIDEO}
                  className="video-element"
                  poster={selectedVideo.thumbnail}
                  onClick={togglePlay}
                />

                {/* Video Controls */}
                <div className="video-controls">
                  <button onClick={togglePlay} className="control-button">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  <div className="progress-bar" ref={progressRef}>
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <span className="duration">{selectedVideo.duration}</span>

                  <button onClick={toggleMute} className="control-button">
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setShowCaptions(!showCaptions)}
                    className={`control-button ${showCaptions ? 'active' : ''}`}
                  >
                    CC
                  </button>
                </div>

                {/* Captions (Demo) */}
                {showCaptions && selectedVideo.captions && (
                  <div className="captions">
                    <p>Welcome to intelligent beauty shopping</p>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="video-info">
                <h3 className="video-title">{selectedVideo.title}</h3>
                <p className="video-description">{selectedVideo.description}</p>
                <div className="video-meta">
                  <span className="difficulty-badge {selectedVideo.difficulty.toLowerCase()}">
                    {selectedVideo.difficulty}
                  </span>
                  <span className="duration-badge">
                    <Clock className="w-4 h-4" />
                    {selectedVideo.duration}
                  </span>
                  {watchedVideos.has(selectedVideo.id) && (
                    <span className="watched-badge">
                      <Award className="w-4 h-4" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Video Grid */
            <div className="video-grid">
              <h2 className="category-title">
                {currentTutorials.categories[selectedCategory].title}
              </h2>
              <div className="videos-list">
                {currentTutorials.categories[selectedCategory].videos.map(video => (
                  <motion.div
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className="video-card"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="video-thumbnail">
                      <img
                        src={video.thumbnail || '/placeholder-video.jpg'}
                        alt={video.title}
                      />
                      <div className="play-overlay">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                      {watchedVideos.has(video.id) && (
                        <div className="watched-indicator">
                          <Award className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="video-card-info">
                      <h4>{video.title}</h4>
                      <p className="text-sm text-gray-400">{video.description}</p>
                      <div className="video-card-meta">
                        <span className="text-xs text-gold">{video.duration}</span>
                        <span className="text-xs text-gray-500">{video.difficulty}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .video-tutorials-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .language-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #1E1E1E;
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .language-options {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .language-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 20px;
          color: #FAFAFA;
          cursor: pointer;
          transition: all 0.3s;
        }

        .language-option:hover {
          border-color: #D4AF37;
          background: rgba(212, 175, 55, 0.1);
        }

        .language-option.active {
          background: linear-gradient(135deg, #D4AF37, #F7E7CE);
          color: #0A0A0A;
          border-color: #D4AF37;
        }

        .flag {
          font-size: 1.2rem;
        }

        .tutorials-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 2rem;
        }

        .tutorials-sidebar {
          background: #1E1E1E;
          border-radius: 8px;
          padding: 2rem;
          border: 1px solid rgba(212, 175, 55, 0.1);
        }

        .progress-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 2rem;
        }

        .progress-ring {
          position: relative;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 1.5rem;
          color: #D4AF37;
          font-weight: 300;
        }

        .categories-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .category-button {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: transparent;
          border: none;
          color: #FAFAFA;
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.3s;
        }

        .category-button:hover {
          background: rgba(212, 175, 55, 0.1);
        }

        .category-button.active {
          background: rgba(212, 175, 55, 0.2);
          border-left: 3px solid #D4AF37;
        }

        .video-area {
          background: #1E1E1E;
          border-radius: 8px;
          padding: 2rem;
          border: 1px solid rgba(212, 175, 55, 0.1);
        }

        .video-player {
          max-width: 100%;
        }

        .video-wrapper {
          position: relative;
          aspect-ratio: 16/9;
          background: #0A0A0A;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: pointer;
        }

        .video-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: linear-gradient(transparent, rgba(10, 10, 10, 0.9));
        }

        .control-button {
          background: none;
          border: none;
          color: #D4AF37;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .control-button:hover {
          transform: scale(1.1);
        }

        .control-button.active {
          color: #F7E7CE;
        }

        .progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(212, 175, 55, 0.2);
          border-radius: 2px;
          cursor: pointer;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #D4AF37, #F7E7CE);
          border-radius: 2px;
          transition: width 0.1s;
        }

        .duration {
          color: #FAFAFA;
          font-size: 0.875rem;
        }

        .captions {
          position: absolute;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(10, 10, 10, 0.8);
          color: #FAFAFA;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          max-width: 80%;
          text-align: center;
        }

        .video-info {
          padding: 1rem 0;
        }

        .video-title {
          font-size: 1.5rem;
          color: #FAFAFA;
          margin-bottom: 0.5rem;
        }

        .video-description {
          color: #FAFAFA;
          opacity: 0.8;
          margin-bottom: 1rem;
        }

        .video-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .difficulty-badge,
        .duration-badge,
        .watched-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 20px;
          color: #D4AF37;
          font-size: 0.875rem;
        }

        .watched-badge {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        .video-grid {
          color: #FAFAFA;
        }

        .category-title {
          font-size: 1.75rem;
          margin-bottom: 1.5rem;
          color: #D4AF37;
        }

        .videos-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .video-card {
          background: #0A0A0A;
          border: 1px solid rgba(212, 175, 55, 0.1);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
        }

        .video-card:hover {
          border-color: #D4AF37;
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.2);
        }

        .video-thumbnail {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
          background: #1E1E1E;
        }

        .video-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 10, 0.5);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .video-card:hover .play-overlay {
          opacity: 1;
        }

        .watched-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          background: rgba(16, 185, 129, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .video-card-info {
          padding: 1rem;
        }

        .video-card-info h4 {
          color: #FAFAFA;
          margin-bottom: 0.5rem;
        }

        .video-card-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 0.5rem;
        }

        @media (max-width: 1024px) {
          .tutorials-layout {
            grid-template-columns: 1fr;
          }

          .tutorials-sidebar {
            display: flex;
            align-items: center;
            gap: 2rem;
            padding: 1rem;
          }

          .categories-nav {
            flex-direction: row;
            flex: 1;
            overflow-x: auto;
          }
        }

        @media (max-width: 768px) {
          .video-tutorials-container {
            padding: 1rem;
          }

          .videos-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}