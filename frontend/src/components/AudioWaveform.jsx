import { useState, useEffect, useRef, useCallback } from 'react'

function AudioWaveform({
  isActive = false,
  analyserNode = null,
  className = '',
  barCount = 48,
  barWidth = 3,
  gap = 2,
  maxHeight = 48,
}) {
  const [waveData, setWaveData] = useState(() => Array(barCount).fill(0.08))
  const rafRef = useRef(null)
  const idleTimeoutRef = useRef(null)
  const dataArrayRef = useRef(null)
  const prevDataRef = useRef(null)

  useEffect(() => {
    setWaveData(Array(barCount).fill(0.08))
    prevDataRef.current = new Float32Array(barCount).fill(0.08)
  }, [barCount])

  const generateData = useCallback(() => {
    if (analyserNode && dataArrayRef.current && isActive) {
      analyserNode.getByteFrequencyData(dataArrayRef.current)

      const samplesPerBar = Math.floor(dataArrayRef.current.length / barCount)
      const prev = prevDataRef.current
      const smoothing = 0.35

      const result = Array(barCount)
        .fill(0)
        .map((_, i) => {
          const start = i * samplesPerBar
          const end = Math.min(start + samplesPerBar, dataArrayRef.current.length)
          let sum = 0
          for (let j = start; j < end; j++) {
            sum += dataArrayRef.current[j]
          }
          const avg = sum / (end - start)
          const normalized = Math.min(1, avg / 128)
          const value = Math.max(0.06, normalized * 0.9 + 0.1)
          const smoothed = prev[i] * smoothing + value * (1 - smoothing)
          prev[i] = smoothed
          return smoothed
        })

      return result
    }

    const prev = prevDataRef.current
    return Array(barCount)
      .fill(0)
      .map((_, i) => {
        if (!isActive) {
          const t = Date.now() * 0.0008
          const breath = Math.sin(t + i * 0.12) * 0.025
          const target = 0.06 + Math.abs(breath)
          prev[i] = prev[i] * 0.6 + target * 0.4
          return prev[i]
        }
        const t = Date.now() * 0.001
        const voice = Math.sin(t * 3.2 + i * 0.28) * 0.35
        const breath = Math.sin(t * 1.1 + i * 0.07) * 0.15
        const detail = Math.sin(t * 6.5 + i * 0.45) * 0.08
        const target = Math.max(0.08, (voice + breath + detail) * 0.55 + 0.3)
        prev[i] = prev[i] * 0.4 + target * 0.6
        return prev[i]
      })
  }, [analyserNode, isActive, barCount])

  useEffect(() => {
    if (analyserNode) {
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.75
      dataArrayRef.current = new Uint8Array(analyserNode.frequencyBinCount)
    }

    if (!prevDataRef.current || prevDataRef.current.length !== barCount) {
      prevDataRef.current = new Float32Array(barCount).fill(0.08)
    }

    const animate = () => {
      setWaveData(generateData())
      rafRef.current = requestAnimationFrame(animate)
    }

    const idle = () => {
      setWaveData(generateData())
      idleTimeoutRef.current = setTimeout(idle, 100)
    }

    if (isActive) {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
      animate()
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      idle()
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
    }
  }, [isActive, analyserNode, barCount, generateData])

  return (
    <div
      className={`flex items-end justify-center w-full ${className}`}
      style={{ gap: `${gap}px`, height: `${maxHeight}px` }}
      role="img"
      aria-label={isActive ? 'Visualisation audio active' : 'Visualisation audio inactive'}
    >
      {waveData.map((h, i) => {
        const barHeight = Math.max(3, h * maxHeight)
        return (
          <div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{
              width: `${barWidth}px`,
              height: `${isActive ? barHeight : barHeight * 0.5}px`,
              background: isActive
                ? `linear-gradient(to top, hsl(0 85% 55%), hsl(15 90% 55%), hsl(35 95% 60%))`
                : 'hsl(var(--muted-foreground) / 0.25)',
              opacity: isActive ? 0.95 : 0.4,
              transition: 'height 60ms ease-out, opacity 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}

export default AudioWaveform
