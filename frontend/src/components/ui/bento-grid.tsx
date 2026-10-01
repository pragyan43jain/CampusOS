import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import type { ReactNode } from "react"

export interface BentoGridProps {
  className?: string
  children?: ReactNode
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 w-full mx-auto",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
export default BentoGrid
