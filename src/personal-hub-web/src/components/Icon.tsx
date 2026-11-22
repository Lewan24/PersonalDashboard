import { lazy, Suspense } from "react";
const LinkIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Link })),
);
const FolderIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Folder })),
);
const ShieldIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Shield })),
);
const ServerIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Server })),
);
const StarIcon = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.Star })),
);
export function Icon({ name }: { name: string }) {
  if (name.startsWith("icon:"))
    return (
      <img className="icon" alt="" src={"/api/v1/icons/" + name.slice(5)} />
    );
  const Component =
    name === "lucide:folder"
      ? FolderIcon
      : name === "lucide:shield"
        ? ShieldIcon
        : name === "lucide:server"
          ? ServerIcon
          : name === "lucide:star"
            ? StarIcon
            : LinkIcon;
  return (
    <Suspense fallback={<span className="icon" />}>
      <Component className="icon" aria-hidden="true" />
    </Suspense>
  );
}
