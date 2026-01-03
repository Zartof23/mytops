import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'

interface AllProvidersProps {
  children: ReactNode
}

/**
 * Wrapper component that includes all necessary providers for testing
 */
function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={0}>
        {children}
      </TooltipProvider>
    </BrowserRouter>
  )
}

/**
 * Custom render function that wraps components with necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: AllProviders,
    ...options
  })
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with our custom version
export { customRender as render }
