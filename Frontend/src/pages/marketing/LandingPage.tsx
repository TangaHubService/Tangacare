import { Navbar } from '../../components/marketing/Navbar';
import { Hero } from '../../components/marketing/Hero';
import { HowItWorks } from '../../components/marketing/HowItWorks';
import { Problems } from '../../components/marketing/Problems';
import { Features } from '../../components/marketing/Features';
import { Pricing } from '../../components/marketing/Pricing';
import { FAQ } from '../../components/marketing/FAQ';
import { Contact } from '../../components/marketing/Contact';
import { CTA } from '../../components/marketing/CTA';
import { Footer } from '../../components/marketing/Footer';

export function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen font-sans selection:bg-teal-100 selection:text-teal-900 dark:selection:bg-teal-900 dark:selection:text-teal-100">
            <Navbar />
            <main className="flex-1">
                <Hero />
                <HowItWorks />
                <Problems />
                <Features />
                <Pricing />
                <FAQ />
                <Contact />
                <CTA />
            </main>
            <Footer />
        </div>
    );
}
