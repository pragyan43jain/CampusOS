import { cn } from "@/lib/utils"
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, type Transition } from "framer-motion"
import React, { ReactNode, useRef, useState } from "react"
import { BorderBeam } from "./border-beam"

const SPRING_TACTILE: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 1,
}

const SPRING_ENTRANCE: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 20,
}

export interface BentoCardProps {
  className?: string
  children?: ReactNode
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  background?: ReactNode
  colSpan?: 1 | 2 | 3 | 4
  rowSpan?: 1 | 2 | 3
  tilt?: boolean
  spotlight?: boolean
  borderAnim?: boolean
  borderAnimColor?: string | { from?: string; to?: string }
  borderAnimDelay?: number
  onClick?: () => void
  ctaText?: string
}

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: SPRING_ENTRANCE 
  },
  hover: {
    scale: 1.01,
    y: -3,
    transition: SPRING_TACTILE
  }
}

export function BentoCard({
  className,
  children,
  title,
  description,
  icon,
  badge,
  background,
  colSpan = 1,
  rowSpan = 1,
  tilt = false,
  spotlight = true,
  borderAnim = false,
  borderAnimColor,
  borderAnimDelay = 0,
  onClick,
  ctaText,
}: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const spotlightX = useMotionValue(0)
  const spotlightY = useMotionValue(0)

  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)

  // Smooth springs for tilt
  const smoothTiltX = useSpring(tiltX, { stiffness: 300, damping: 30 })
  const smoothTiltY = useSpring(tiltY, { stiffness: 300, damping: 30 })

  const rotateX = useTransform(smoothTiltY, [-150, 150], [4, -4])
  const rotateY = useTransform(smoothTiltX, [-150, 150], [-4, 4])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    
    // For Spotlight (relative to top left)
    spotlightX.set(e.clientX - rect.left)
    spotlightY.set(e.clientY - rect.top)

    // For Tilt (relative to center)
    if (tilt) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      tiltX.set(e.clientX - rect.left - centerX)
      tiltY.set(e.clientY - rect.top - centerY)
    }
  }

  function handleMouseEnter() {
    setIsHovered(true)
  }

  function handleMouseLeave() {
    setIsHovered(false)
    if (tilt) {
      tiltX.set(0)
      tiltY.set(0)
    }
  }

  const spotlightBackground = useMotionTemplate`
    radial-gradient(
      320px circle at ${spotlightX}px ${spotlightY}px,
      rgba(255, 255, 255, 0.05),
      transparent 80%
    )
  `

  // Calculate CSS grid spans
  const colSpanClass = {
    1: "col-span-1",
    2: "col-span-1 md:col-span-2",
    3: "col-span-1 md:col-span-2 lg:col-span-3",
    4: "col-span-1 md:col-span-2 lg:col-span-4",
  }[colSpan] || "col-span-1"

  const rowSpanClass = {
    1: "row-span-1",
    2: "row-span-1 md:row-span-2",
    3: "row-span-1 md:row-span-3",
  }[rowSpan] || "row-span-1"

  return (
    <motion.div
      ref={ref}
      variants={itemVariants}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover="hover"
      whileTap={{ scale: 0.985 }}
      transition={SPRING_TACTILE}
      style={{
        ...(tilt && { rotateX, rotateY }),
        transformStyle: "preserve-3d",
        cursor: onClick ? "pointer" : "default",
      }}
      className={cn(
        "card-hover group relative flex flex-col justify-between overflow-hidden rounded-2xl",
        "bg-[#141414] border border-[#222222]",
        "shadow-lg transition-all duration-300",
        colSpanClass,
        rowSpanClass,
        className
      )}
    >
      {/* Spotlight Effect */}
      {spotlight && (
        <motion.div
          className={cn(
            "pointer-events-none absolute -inset-px z-0 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          style={{ background: spotlightBackground }}
        />
      )}

      {/* Border Beam */}
      {borderAnim && (
        <BorderBeam
          isHovered={isHovered}
          colorFrom={typeof borderAnimColor === 'object' ? borderAnimColor?.from : "transparent"}
          colorTo={typeof borderAnimColor === 'string' ? borderAnimColor : borderAnimColor?.to}
          delay={borderAnimDelay}
        />
      )}

      {/* Background Effect */}
      {background && (
        <div className="absolute inset-0 z-0 opacity-40 transition-opacity duration-300 group-hover:opacity-80">
          {background}
        </div>
      )}

      {/* Content Container */}
      <div className="relative z-10 flex h-full flex-col justify-between p-5 md:p-6">
        {/* Header Section: Icon + Title + Badge */}
        {(title || icon || badge) && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-white">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="text-base md:text-lg font-semibold tracking-tight text-white truncate">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {badge && (
              <div className="shrink-0">
                {badge}
              </div>
            )}
          </div>
        )}

        {/* Main Visual / Children Content */}
        {children && (
          <div className="flex-1 my-1">
            {children}
          </div>
        )}

        {/* Footer CTA */}
        {ctaText && (
          <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between text-xs text-neutral-400 group-hover:text-white transition-colors">
            <span>{ctaText}</span>
            <span className="transform transition-transform group-hover:translate-x-1">→</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
