import { z } from "zod";

export const SEARCH_MIN_LENGTH = 2;

export const searchInputSchema = z.object({
  systemSlug: z.string().trim().min(1).max(100),
  query: z.string().trim().min(SEARCH_MIN_LENGTH).max(100),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export type SearchMatchSource = "title" | "content" | "example";

export type SearchResult = {
  id: string;
  title: string;
  href: string;
  breadcrumb: string[];
  snippet: string | null;
  matchedIn: SearchMatchSource;
};

export type SearchResponse =
  | { status: "ok"; results: SearchResult[] }
  | { status: "invalid" }
  | { status: "no-profile" }
  | { status: "error" };
