"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function themeForPath(pathname: string) {
  if (pathname.startsWith("/india/north")) return "north";
  if (pathname.startsWith("/india/central")) return "central";
  if (pathname.startsWith("/spiritual")) return "spiritual";
  if (pathname.startsWith("/group-retreats")) return "groups";
  if (pathname.startsWith("/international")) return "international";
  if (pathname === "/") return "home";
  return "default";
}

export default function RouteTheme() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.dataset.travelTheme = themeForPath(pathname || "/");
    return () => {
      delete document.body.dataset.travelTheme;
    };
  }, [pathname]);

  return null;
}
