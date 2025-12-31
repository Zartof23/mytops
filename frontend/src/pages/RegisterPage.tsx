import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { OAuthButtons, OAuthDivider } from '../components/OAuthButtons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function RegisterPage() {
  const { signUp, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await signUp(email, password)
    if (error) {
      toast.error("Something went wrong. My bad, probably.")
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="max-w-sm mx-auto py-12">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent you a confirmation link. Click it to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground italic">
              Yes, I know email confirmation is annoying. Blame the spammers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>Start tracking your favorites.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground italic mb-6 text-center">
            Yes, the form is just these fields. I don't need your data.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-[10px] text-muted-foreground">
                At least 6 characters. No symbols required.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <OAuthDivider />
          <OAuthButtons disabled={loading} />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
