import { Globe2, CalendarDays, GraduationCap, Sparkles, Heart, Clock } from 'lucide-react';
import { Avatar, Card, SkillChip, EmptyState, Badge, levelLabel } from '../../components/ui/index.js';
import { WeeklyBars } from '../availability/WeeklyBars.jsx';
import { formatDate, zoneOffsetLabel } from '../../utils/format.js';
import styles from './Profile.module.css';

/**
 * A public profile exactly as other users see it. Used by "My profile",
 * "Preview as others see it" and other users' profiles, so all three always
 * match (SB1/US30, US31, US46).
 */
export function ProfileView({ profile, emptyHints = false, headerActions }) {
  const teach = profile.teachSkills ?? [];
  const learn = profile.learnSkills ?? [];
  return (
    <div className={styles.layout}>
      <section className={styles.hero} aria-label="Profile summary">
        <Avatar name={profile.name} src={profile.avatarUrl} size={96} />
        <div className={styles.heroText}>
          <h2 className={styles.name}>{profile.name}</h2>
          {profile.headline ? (
            <p className={styles.headline}>{profile.headline}</p>
          ) : emptyHints ? (
            <p className={styles.missing}>No headline yet</p>
          ) : null}
          <ul role="list" className={styles.meta}>
            <li>
              <Globe2 size={16} aria-hidden="true" /> {profile.timezone?.replace(/_/g, ' ')} (
              {zoneOffsetLabel(profile.timezone)})
            </li>
            {profile.memberSince ? (
              <li>
                <CalendarDays size={16} aria-hidden="true" /> Member since{' '}
                {formatDate(profile.memberSince, profile.timezone, {
                  dateStyle: undefined,
                  month: 'long',
                  year: 'numeric',
                })}
              </li>
            ) : null}
          </ul>
          <div className={styles.heroBadges}>
            <Badge tone="teach" icon={Sparkles}>
              Teaches {teach.length}
            </Badge>
            <Badge tone="learn" icon={GraduationCap}>
              Learning {learn.length}
            </Badge>
          </div>
        </div>
        {headerActions ? <div className={styles.heroActions}>{headerActions}</div> : null}
      </section>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Card title="About">
            {profile.bio ? (
              <p className={styles.bio}>{profile.bio}</p>
            ) : (
              <p className={styles.missing}>
                {emptyHints ? 'Add a short bio so others know your background.' : 'No bio yet.'}
              </p>
            )}
          </Card>

          <Card title="Can teach" subtitle="Skills and experience level">
            {teach.length === 0 ? (
              <EmptyState
                compact
                icon={Sparkles}
                title="No teaching skills yet"
                description={emptyHints ? 'Add skills you can teach to appear in mentor search.' : undefined}
              />
            ) : (
              <ul role="list" className={styles.skillList}>
                {teach.map((t) => (
                  <li key={t.id} className={styles.skillItem}>
                    <SkillChip
                      kind="teach"
                      name={t.skill?.name ?? 'Skill'}
                      level={t.proficiency}
                      pending={t.skill?.status === 'pending'}
                    />
                    <span className={styles.skillMeta}>
                      {levelLabel('teach', t.proficiency)}
                      {t.yearsExperience ? ` · ${t.yearsExperience} yr${t.yearsExperience === 1 ? '' : 's'}` : ''}
                    </span>
                    {t.description ? <p className={styles.skillText}>{t.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Wants to learn" subtitle="Skills and preferred level">
            {learn.length === 0 ? (
              <EmptyState compact icon={GraduationCap} title="No learning goals yet" />
            ) : (
              <ul role="list" className={styles.skillList}>
                {learn.map((l) => (
                  <li key={l.id} className={styles.skillItem}>
                    <SkillChip
                      kind="learn"
                      name={l.skill?.name ?? 'Skill'}
                      level={l.preferredLevel}
                      pending={l.skill?.status === 'pending'}
                    />
                    <span className={styles.skillMeta}>
                      Wants {levelLabel('learn', l.preferredLevel).toLowerCase()} level
                    </span>
                    {l.goal ? <p className={styles.skillText}>{l.goal}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className={styles.side}>
          <Card title="Weekly availability">
            {profile.availability?.length ? (
              <WeeklyBars slots={profile.availability} timezone={profile.timezone} />
            ) : (
              <EmptyState compact icon={Clock} title="No availability yet" />
            )}
          </Card>
          <Card title="Learning interests">
            {profile.learningInterests?.length ? (
              <ul role="list" className={styles.interests}>
                {profile.learningInterests.map((c) => (
                  <li key={c.id} className={styles.interest}>
                    <Heart size={14} aria-hidden="true" /> {c.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.missing}>No interests chosen.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
