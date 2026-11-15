import CTA from '../components/landing/CTA.jsx';
import DashboardPreview from '../components/landing/DashboardPreview.jsx';
import Features from '../components/landing/Features.jsx';
import Hero from '../components/landing/Hero.jsx';
import HowItWorks from '../components/landing/HowItWorks.jsx';

export default function LandingPage() {
  return (
    <>
      <div className="landing-opening public-container">
        <Hero />
        <DashboardPreview />
      </div>
      <Features />
      <HowItWorks />
      <CTA />
    </>
  );
}
