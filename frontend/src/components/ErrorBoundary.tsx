import React, { Component } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4">Something broke</h1>
            <p className="text-muted-foreground mb-2">
              Honestly, I'm surprised it worked this long.
            </p>
            <p className="text-sm text-muted-foreground mb-6 font-mono bg-muted p-2 rounded">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <Button type="button" onClick={this.handleReset}>
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
