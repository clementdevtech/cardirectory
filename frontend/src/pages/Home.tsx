import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'react-toastify'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FeaturedCars from '@/components/home/FeaturedCars'


const Home: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { refreshUser } = useAuth()

  // Handle Google login callback
  useEffect(() => {
    const googleLoginSuccess = searchParams.get('google_login')
    const googleError = searchParams.get('google_error')

    if (googleLoginSuccess === 'success') {
      // Refresh user data from backend
      refreshUser().then(() => {
        toast.success('Welcome! You are now logged in.')
        // Clear the query params
        window.history.replaceState({}, document.title, window.location.pathname)
      })
    } else if (googleError) {
      const errorMessages: { [key: string]: string } = {
        cancelled: 'Google login was cancelled.',
        email_not_verified: 'Your Google email is not verified.',
        failed: 'Google login failed. Please try again.',
      }
      toast.error(errorMessages[googleError] || 'Google login failed.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [searchParams, refreshUser])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="gradient-hero py-24 text-center">
          <div className="container px-4">
            <h1 className="text-4xl font-bold mb-2">Find your next car</h1>
            <p className="text-muted-foreground">Search thousands of vehicles across Kenya.</p>
          </div>
        </section>
        <FeaturedCars />
      </main>
      <Footer />
    </div>
  )
}


export default Home