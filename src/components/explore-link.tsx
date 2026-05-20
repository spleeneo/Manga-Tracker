import Link from "next/link";
import { Compass } from "lucide-react";

export function ExploreLink() {
  return (
    <Link
      href="/explore"
      className="ui-button ui-button-secondary h-10 w-10 px-0 sm:w-auto sm:px-3.5"
      aria-label="Explore manga"
      title="Explore manga"
    >
      <Compass className="h-4 w-4" />
      <span className="hidden sm:inline">Explore</span>
    </Link>
  );
}
