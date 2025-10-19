import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FeaturedCars from '@/components/home/FeaturedCars'


const Home: React.FC = () => {
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