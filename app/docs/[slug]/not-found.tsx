import Link from "next/link";
import { Compass } from "lucide-react";

export default function DocsSlugNotFound() {
  return (
    <article>
      <header className="mb-8">
        <span className="eyebrow">
          <Compass className="h-3.5 w-3.5" aria-hidden />
          Docs
        </span>
        <h1 className="mt-5 font-display text-display-lg font-semibold tracking-tight text-balance text-ink-900 dark:text-white">
          That page drifted off the map.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-lg text-ink-600 dark:text-ink-300">
          We couldn&apos;t find that doc. Either the slug moved upstream or the link is stale.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link href="/docs" className="btn-primary">
          Browse all docs
        </Link>
        <a
          href="https://docs.gulfcoastmesh.org"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
        >
          Try the MkDocs site
        </a>
      </div>
    </article>
  );
}
