import { useState } from "react";
import { safeUrl } from "../api";
import {
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  ChartColumn,
  CircleHelp,
  ClipboardList,
  Cloud,
  Code,
  FileText,
  Folder,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  House,
  Image,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Music,
  Package,
  Search,
  Server,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Terminal,
  Video,
  Wallet,
} from "lucide-react";

export const builtInIcons = {
  "lucide:link": Link,
  "lucide:folder": Folder,
  "lucide:shield": Shield,
  "lucide:server": Server,
  "lucide:star": Star,
  "lucide:globe": Globe,
  "lucide:house": House,
  "lucide:briefcase": Briefcase,
  "lucide:book-open": BookOpen,
  "lucide:calendar": Calendar,
  "lucide:camera": Camera,
  "lucide:chart-column": ChartColumn,
  "lucide:circle-help": CircleHelp,
  "lucide:clipboard-list": ClipboardList,
  "lucide:cloud": Cloud,
  "lucide:code": Code,
  "lucide:file-text": FileText,
  "lucide:gamepad-2": Gamepad2,
  "lucide:graduation-cap": GraduationCap,
  "lucide:heart": Heart,
  "lucide:image": Image,
  "lucide:mail": Mail,
  "lucide:map-pin": MapPin,
  "lucide:message-circle": MessageCircle,
  "lucide:monitor": Monitor,
  "lucide:music": Music,
  "lucide:package": Package,
  "lucide:search": Search,
  "lucide:settings": Settings,
  "lucide:shopping-cart": ShoppingCart,
  "lucide:terminal": Terminal,
  "lucide:video": Video,
  "lucide:wallet": Wallet,
  "lucide:bell": Bell,
};

export const automaticIcon = "auto:favicon";

function Favicon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Link className="icon" aria-hidden="true" />
  ) : (
    <img
      className="icon"
      alt=""
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Icon({ name, url }: { name: string; url?: string | null }) {
  if (name === automaticIcon && safeUrl(url)) {
    const address = new URL("/favicon.ico", new URL(url!).origin);
    return <Favicon key={address.href} src={address.href} />;
  }
  if (name.startsWith("icon:"))
    return (
      <img className="icon" alt="" src={"/api/v1/icons/" + name.slice(5)} />
    );
  const Component = Object.hasOwn(builtInIcons, name)
    ? builtInIcons[name as keyof typeof builtInIcons]
    : Link;
  return <Component className="icon" aria-hidden="true" />;
}
