'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-xl border border-border/60 bg-muted/30" />
    )
  }

  const isDark = resolvedTheme === 'dark'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark and light mode"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground shadow-2xs transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90 text-foreground" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0 text-foreground" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
