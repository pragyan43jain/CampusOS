import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export interface BorderBeamProps {
  className?: string
  duration?: number
  borderWidth?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
  isHovered?: boolean
}

export function BorderBeam({
  className,
  duration = 10,
  borderWidth = 1.5,
  colorFrom = "rgba(16, 185, 129, 0)",
  colorTo = "rgba(16, 185, 129, 0.45)",
  delay = 0,
  isHovered = false,
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 rounded-[inherit] border border-transparent",
        "[mask-clip:padding-box,border-box] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] [mask-composite:exclude]",
        className
      )}
      style={{
        borderWidth: borderWidth,
      }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `conic-gradient(from 0deg, ${colorFrom} 0%, ${colorTo} 22%, ${colorFrom} 44%, ${colorFrom} 100%)`,
          opacity: isHovered ? 0.95 : 0.4,
          transition: "opacity 0.3s ease",
        }}
        initial={{ rotate: delay * 60 }}
        animate={{ rotate: 360 + delay * 60 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: duration,
        }}
      />
    </div>
  )
}
