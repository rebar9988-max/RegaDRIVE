import { House, BookOpen, CheckCircle, Trophy, List, Warning, ChartBar, Translate, BookmarkSimple, MapPin, UserCircle, Lock, Gear, Info, Flame, Target, Star, ArrowRight, Sparkle, Bell, CalendarCheck, Car, Play, WifiHigh, ShieldCheck, Devices, X, DownloadSimple, SignOut, Trash, CloudArrowUp, CloudArrowDown, Globe, SealCheck, WarningCircle } from "@phosphor-icons/react";
const icons = { home: House, book: BookOpen, check: CheckCircle, exam: Trophy, trophy: Trophy, more: List, sign: Warning, chart: ChartBar, words: Translate, bookmark: BookmarkSimple, pin: MapPin, user: UserCircle, lock: Lock, gear: Gear, info: Info, flame: Flame, target: Target, star: Star, arrow: ArrowRight, sparkle: Sparkle, bell: Bell, calendar: CalendarCheck, car: Car, play: Play, wifi: WifiHigh, shield: ShieldCheck, devices: Devices, close: X, download: DownloadSimple, signout: SignOut, trash: Trash, cloudUp: CloudArrowUp, cloudDown: CloudArrowDown, globe: Globe, verified: SealCheck, alert: WarningCircle };
export type IconName = keyof typeof icons;
export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = icons[name];
  return <Component className={className} size={24} weight="bold" aria-hidden="true" focusable="false" />;
}
