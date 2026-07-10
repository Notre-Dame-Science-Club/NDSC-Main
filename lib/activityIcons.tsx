import {
  Microscope, Mic, Sun, BookOpen, Trophy, Radio, TestTube, Lightbulb,
  Globe, Target, Dna, FlaskConical, Telescope, GraduationCap, type LucideIcon,
} from "lucide-react";

export const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  microscope: Microscope,
  mic: Mic,
  sun: Sun,
  "book-open": BookOpen,
  trophy: Trophy,
  radio: Radio,
  "test-tube": TestTube,
  lightbulb: Lightbulb,
  globe: Globe,
  target: Target,
  dna: Dna,
  "flask-conical": FlaskConical,
  telescope: Telescope,
  "graduation-cap": GraduationCap,
};

export const ACTIVITY_ICON_OPTIONS = Object.keys(ACTIVITY_ICON_MAP);

/** Renders a lucide icon by its string key (as stored in the DB `icon` field). */
export function ActivityIcon({
  name,
  className,
  size = 18,
  strokeWidth = 1.9,
}: {
  name?: string | null;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = (name && ACTIVITY_ICON_MAP[name]) || FlaskConical;
  return <Icon className={className} size={size} strokeWidth={strokeWidth} />;
}
