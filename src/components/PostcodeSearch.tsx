"use client";

import { useState } from "react";

interface PostcodeSearchProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export default function PostcodeSearch({ onSearch, isLoading }: PostcodeSearchProps) {
  const [query, setQuery] = useState("");

  const isValid = query.trim().length >= 2;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid && !isLoading) {
      onSearch(query.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        placeholder="Postcode or address (e.g. 1011 or Damrak 1 Amsterdam)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-base outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
      />
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#E65100" }}
      >
        {isLoading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
