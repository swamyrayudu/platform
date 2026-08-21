'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:py-3.5 group-[.toaster]:px-4 font-sans',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:text-xs',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
