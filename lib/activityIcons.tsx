import {
  Microscope, Mic, Sun, BookOpen, Trophy, Satellite, FlaskConical,
  Lightbulb, Globe, Target, Dna, Beaker, Telescope, GraduationCap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Activity-type icon system.
 *
 * Activity types store an `icon` string in the database. Historically this
 * was a raw emoji character; new records store one of the keys below.
 * `ActivityIcon` renders a proper lucide icon for either case, so legacy
 * data keeps working without a migration while new selections are
 * professional vector icons instead of emoji.
 */
export const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  microscope: Microscope,
  mic: Mic,
  sun: Sun,
  book: BookOpen,
  trophy: Trophy,
  satellite: Satellite,
  flask: FlaskConical,
  lightbulb: Lightbulb,
  globe: Globe,
  target: Target,
  dna: Dna,
  beaker: Beaker,
  telescope: Telescope,
  graduation: GraduationCap,
}

// Maps legacy emoji values (already stored in the database) to the new keys.
const LEGACY_EMOJI_MAP: Record<string, string> = {
  '🔬': 'microscope',
  '🎤': 'mic',
  '☀️': 'sun',
  '☀': 'sun',
  '📚': 'book',
  '🏆': 'trophy',
  '📡': 'satellite',
  '🧪': 'flask',
  '💡': 'lightbulb',
  '🌍': 'globe',
  '🎯': 'target',
  '🧬': 'dna',
  '⚗️': 'beaker',
  '⚗': 'beaker',
  '🔭': 'telescope',
  '🎓': 'graduation',
}

export const ACTIVITY_ICON_OPTIONS = Object.keys(ACTIVITY_ICON_MAP)

export function resolveActivityIconKey(icon: string | null | undefined): string {
  if (!icon) return 'microscope'
  if (ACTIVITY_ICON_MAP[icon]) return icon
  return LEGACY_EMOJI_MAP[icon] || 'microscope'
}

export function ActivityIcon({ icon, size = 18, className, style }: {
  icon: string | null | undefined; size?: number; className?: string; style?: React.CSSProperties
}) {
  const Icon = ACTIVITY_ICON_MAP[resolveActivityIconKey(icon)]
  return <Icon size={size} className={className} style={style} />
}
