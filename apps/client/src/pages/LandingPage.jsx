import { ArrowRight, CalendarClock, Search, Sparkles, UserRoundPlus, Globe2, ShieldCheck, Repeat } from 'lucide-react';
import { Button } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';
import styles from './LandingPage.module.css';

const STEPS = [
  {
    icon: UserRoundPlus,
    title: 'Create your profile',
    text: 'List the skills you can teach and the ones you want to learn, with your level for each.',
  },
  {
    icon: CalendarClock,
    title: 'Share your availability',
    text: 'Pick the days and hours that suit you. Time zones are handled for you.',
  },
  {
    icon: Search,
    title: 'Find the right peer',
    text: 'Search by skill to find mentors, then meet for a focused 30-minute session.',
  },
];

const FEATURES = [
  {
    icon: Repeat,
    title: 'Teach and learn',
    text: 'Every member can be a mentor and a learner. Swap skills with people who need yours.',
  },
  {
    icon: Sparkles,
    title: 'Skill levels that mean something',
    text: 'Beginner to expert levels help learners pick mentors with the right experience.',
  },
  {
    icon: Globe2,
    title: 'Built for every time zone',
    text: 'Availability is stored with your time zone, so matches happen at sensible local times.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    text: 'Your email and account details are never shown. Others see only your public profile.',
  },
];

/** Public landing page – the first impression and the way into sign-up (SB1/US15). */
export default function LandingPage() {
  useDocumentTitle('Learn and teach in 30 minutes');
  const { isAuthenticated } = useAuth();
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Peer-to-peer micro-learning</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              Learn a skill from a peer in <span className={styles.highlight}>30 focused minutes</span>.
            </h1>
            <p className={styles.heroLead}>
              SkillBridge connects people who want to teach what they know with people who want to learn it. Short
              one-on-one sessions, real skills, no fluff.
            </p>
            <div className={styles.heroActions}>
              {isAuthenticated ? (
                <Button to="/dashboard" size="lg" rightIcon={ArrowRight}>
                  Go to your dashboard
                </Button>
              ) : (
                <>
                  <Button to="/register" size="lg" rightIcon={ArrowRight}>
                    Get started free
                  </Button>
                  <Button to="/login" size="lg" variant="secondary">
                    I already have an account
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.mockCard}>
              <div className={styles.mockHeader}>
                <span className={styles.mockAvatar}>PS</span>
                <div>
                  <p className={styles.mockName}>Priya Sharma</p>
                  <p className={styles.mockMeta}>Frontend developer · Kolkata</p>
                </div>
              </div>
              <p className={styles.mockLabel}>Teaches</p>
              <div className={styles.mockChips}>
                <span className={styles.chipTeach}>React ●●●●</span>
                <span className={styles.chipTeach}>JavaScript ●●●○</span>
              </div>
              <p className={styles.mockLabel}>Wants to learn</p>
              <div className={styles.mockChips}>
                <span className={styles.chipLearn}>Python ●○○</span>
              </div>
              <div className={styles.mockSession}>
                <CalendarClock size={16} /> Next session · Thu 18:30 · 30 min
              </div>
            </div>
            <div className={`${styles.floating} ${styles.floatA}`}>
              <Repeat size={16} /> Skill exchange match
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how-title">
        <div className={styles.sectionInner}>
          <h2 id="how-title" className={styles.sectionTitle}>
            How it works
          </h2>
          <ol className={styles.steps}>
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <Icon size={24} className={styles.stepIcon} aria-hidden="true" />
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepText}>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.muted}`} aria-labelledby="features-title">
        <div className={styles.sectionInner}>
          <h2 id="features-title" className={styles.sectionTitle}>
            Made for practical learning
          </h2>
          <ul role="list" className={styles.features}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureText}>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!isAuthenticated ? (
        <section className={styles.cta} aria-labelledby="cta-title">
          <h2 id="cta-title" className={styles.ctaTitle}>
            Ready to share what you know?
          </h2>
          <p className={styles.ctaText}>It takes two minutes to set up your profile.</p>
          <Button to="/register" size="lg" rightIcon={ArrowRight}>
            Create your free account
          </Button>
        </section>
      ) : null}
    </>
  );
}
