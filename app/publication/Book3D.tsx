'use client'
import { useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import styles from './Book3D.module.css'

type Book3DProps = {
  coverImageUrl?: string
  title: string
  onClick?: () => void
}

export default function Book3D({ coverImageUrl, title, onClick }: Book3DProps) {
  const bookRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!bookRef.current) return
      const rect = bookRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const x = (e.clientX - centerX) / (rect.width / 2)
      const y = (e.clientY - centerY) / (rect.height / 2)
      setMousePos({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const rotateX = -mousePos.y * 8
  const rotateY = mousePos.x * 8

  return (
    <div className={styles.scene} ref={bookRef}>
      <div
        className={styles.book}
        style={{
          transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
        }}
        onClick={onClick}
      >
        {/* Front Cover */}
        <div className={styles.bookFront}>
          {coverImageUrl ? (
            <>
              <img
                src={coverImageUrl}
                alt={title}
                className={styles.coverImage}
              />
              <div className={styles.coverGloss} />
            </>
          ) : (
            <div className={styles.defaultCover}>
              <div className={styles.coverPattern} />
              <BookOpen size={80} className={styles.coverIcon} />
              <div className={styles.coverTitle}>{title}</div>
              <div className={styles.coverGloss} />
            </div>
          )}
        </div>

        {/* Spine */}
        <div className={styles.bookSpine}>
          <div className={styles.spineText}>{title}</div>
        </div>

        {/* Back Cover */}
        <div className={styles.bookBack}>
          <div className={styles.backPattern} />
        </div>

        {/* Top */}
        <div className={styles.bookTop} />

        {/* Bottom */}
        <div className={styles.bookBottom} />

        {/* Right side (pages) */}
        <div className={styles.bookRight}>
          <div className={styles.pages} />
        </div>

        {/* Left side */}
        <div className={styles.bookLeft} />

        {/* Glow effect */}
        <div className={styles.glow}
          style={{
            transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`
          }}
        />
      </div>

      {/* Floating particles */}
      <div className={styles.particles}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}
