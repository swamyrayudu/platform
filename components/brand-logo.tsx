import Image from 'next/image'
import { cn } from '@/lib/utils'

/** One vector asset keeps the website's mark crisp at every display size. */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return <Image src="/rsd-logo.svg" alt="" aria-hidden width={64} height={64}
    unoptimized className={cn('shrink-0', className)} />
}

export function BrandLogo() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <span className="sr-only">RSD Education</span>
      <span aria-hidden className="flex min-w-0 flex-col">
        <span className="text-[18px] font-bold leading-5 tracking-[0.08em] text-foreground">RSD</span>
        <span className="text-[11px] font-medium leading-4 tracking-[0.03em] text-muted-foreground">Education</span>
      </span>
    </span>
  )
}
