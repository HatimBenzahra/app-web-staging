import React from 'react'

const AUDIO_TIME_THROTTLE_MS = 200

/**
 * Encapsulates the audio playback bridge between WaveSurfer and the review UI.
 *
 * - Keeps the high-frequency time updates inside a ref so the parent component
 *   does not re-render at every audio tick.
 * - Exposes a throttled `audioCurrentTime` state for components that genuinely
 *   need to react to the timeline (e.g. progress bars, conversation highlight).
 * - Provides `playRange(start, end)` to seek+play an arbitrary audio range and
 *   auto-pause at the end boundary.
 *
 * @returns {{
 *   handleWavesurferReady: (ws: any) => void,
 *   audioCurrentTime: number,
 *   audioCurrentTimeRef: React.MutableRefObject<number>,
 *   isAudioPlaying: boolean,
 *   playingRangeId: string | null,
 *   playRange: (id: string, start: number, end: number | null) => void,
 *   pauseAudio: () => void,
 *   togglePlayRange: (id: string, start: number, end: number | null) => void,
 *   resetAudio: () => void,
 * }}
 */
export function useAudioSync() {
  const waveSurferRef = React.useRef(null)
  const cleanupRef = React.useRef([])
  const audioCurrentTimeRef = React.useRef(0)
  const lastSyncRef = React.useRef(0)
  const activeRangeRef = React.useRef(null)

  const [audioCurrentTime, setAudioCurrentTimeState] = React.useState(0)
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false)
  const [playingRangeId, setPlayingRangeId] = React.useState(null)

  const setAudioCurrentTime = React.useCallback((time, { force = false } = {}) => {
    audioCurrentTimeRef.current = time
    const now = performance.now()
    if (force || now - lastSyncRef.current >= AUDIO_TIME_THROTTLE_MS) {
      lastSyncRef.current = now
      setAudioCurrentTimeState(time)
    }
  }, [])

  const detachListeners = React.useCallback(() => {
    cleanupRef.current.forEach(cleanup => cleanup?.())
    cleanupRef.current = []
  }, [])

  const handleWavesurferReady = React.useCallback(
    ws => {
      detachListeners()
      waveSurferRef.current = ws
      cleanupRef.current = [
        ws.on('timeupdate', time => setAudioCurrentTime(time)),
        ws.on('interaction', time => setAudioCurrentTime(time, { force: true })),
        ws.on('play', () => setIsAudioPlaying(true)),
        ws.on('pause', () => setIsAudioPlaying(false)),
        ws.on('finish', () => {
          setIsAudioPlaying(false)
          setPlayingRangeId(null)
          activeRangeRef.current = null
        }),
      ]
    },
    [detachListeners, setAudioCurrentTime]
  )

  React.useEffect(() => detachListeners, [detachListeners])

  const pauseAudio = React.useCallback(() => {
    waveSurferRef.current?.pause()
    setIsAudioPlaying(false)
  }, [])

  const playRange = React.useCallback(
    (id, start, end) => {
      if (start === null || start === undefined) return
      const startTime = Math.max(0, Number(start) || 0)
      activeRangeRef.current = {
        id,
        start: startTime,
        end: end === null || end === undefined ? null : Number(end),
      }
      setAudioCurrentTime(startTime, { force: true })
      if (!waveSurferRef.current) {
        setPlayingRangeId(null)
        setIsAudioPlaying(false)
        return
      }
      waveSurferRef.current.setTime(startTime)
      setPlayingRangeId(id)
      setIsAudioPlaying(true)
      void Promise.resolve(waveSurferRef.current.play()).catch(() => {
        setIsAudioPlaying(false)
        setPlayingRangeId(null)
        activeRangeRef.current = null
      })
    },
    [setAudioCurrentTime]
  )

  const togglePlayRange = React.useCallback(
    (id, start, end) => {
      if (id && isAudioPlaying && playingRangeId === id) {
        pauseAudio()
        return
      }
      playRange(id, start, end)
    },
    [isAudioPlaying, pauseAudio, playRange, playingRangeId]
  )

  const resetAudio = React.useCallback(() => {
    setPlayingRangeId(null)
    setIsAudioPlaying(false)
    activeRangeRef.current = null
    setAudioCurrentTime(0, { force: true })
  }, [setAudioCurrentTime])

  // Auto-pause at the end of the active range.
  React.useEffect(() => {
    const range = activeRangeRef.current
    if (!isAudioPlaying || !range || range.end === null) return
    if (audioCurrentTime < range.end - 0.05) return
    if (audioCurrentTime <= range.start + 0.15) return
    waveSurferRef.current?.pause()
    waveSurferRef.current?.setTime(range.end)
    setAudioCurrentTime(range.end, { force: true })
    setIsAudioPlaying(false)
    setPlayingRangeId(null)
    activeRangeRef.current = null
  }, [audioCurrentTime, isAudioPlaying, setAudioCurrentTime])

  return {
    handleWavesurferReady,
    audioCurrentTime,
    audioCurrentTimeRef,
    isAudioPlaying,
    playingRangeId,
    playRange,
    pauseAudio,
    togglePlayRange,
    resetAudio,
  }
}
