"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countActiveFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { fmtDate } from "@/lib/format";
import { matchesPos, POSITION_GROUPS, type PositionGroup } from "@/lib/positions";
import { shortName, type PlayerLite, type SessionLite } from "@/lib/payload";
import { cn } from "@/lib/utils";

export type FilterFacet = "pos" | "who" | "kind" | "drill" | "dates";

export const filterSelectClass =
  "h-8 rounded-lg border border-navy-700 bg-navy-800 px-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/**
 * The one filter surface every analysis page shares: position pills, player
 * combobox, session kind / drill / date-window selects. Every control applies
 * instantly through useFilters — there is no Apply button anywhere.
 */
export default function FilterBar({
  filters,
  onChange,
  show,
  players = [],
  sessions = [],
  drills = [],
  leading,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  show: FilterFacet[];
  players?: PlayerLite[];
  sessions?: SessionLite[];
  drills?: string[];
  /** Page-specific control (e.g. metric select) rendered at the start of the bar. */
  leading?: React.ReactNode;
}) {
  const dates = [...new Set(sessions.map((s) => s.date))];
  const active = countActiveFilters(filters);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {leading}

      {show.includes("pos") ? (
        <ToggleGroup
          multiple
          value={filters.pos}
          onValueChange={(value) => onChange({ pos: value as PositionGroup[] })}
          aria-label="Filter by position"
        >
          {POSITION_GROUPS.map((g) => (
            <ToggleGroupItem
              key={g}
              value={g}
              size="sm"
              variant="outline"
              className="border-navy-700 px-2.5 font-semibold text-ink-muted data-pressed:border-gold data-pressed:bg-gold data-pressed:text-navy-950"
              aria-label={`Position ${g}`}
            >
              {g}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      {show.includes("who") ? (
        <PlayerCombobox
          players={players.filter((p) => matchesPos(p.position, filters.pos))}
          selected={filters.who}
          onChange={(who) => onChange({ who })}
        />
      ) : null}

      {show.includes("kind") ? (
        <select
          className={filterSelectClass}
          value={filters.kind}
          onChange={(e) => onChange({ kind: e.target.value })}
          aria-label="Session kind"
        >
          <option value="all">All sessions</option>
          <option value="practice">Practices</option>
          <option value="scrimmage">Scrimmages</option>
          <option value="match">Matches</option>
        </select>
      ) : null}

      {show.includes("drill") && drills.length > 0 ? (
        <select
          className={filterSelectClass}
          value={filters.drill}
          onChange={(e) => onChange({ drill: e.target.value })}
          aria-label="Drill"
        >
          <option value="all">All drills</option>
          {drills.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      ) : null}

      {show.includes("dates") ? (
        <>
          <select
            className={filterSelectClass}
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            aria-label="From date"
          >
            <option value="">From start</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                from {fmtDate(d)}
              </option>
            ))}
          </select>
          <select
            className={filterSelectClass}
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            aria-label="To date"
          >
            <option value="">To latest</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                to {fmtDate(d)}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-ink-muted hover:text-ink"
        >
          <X data-icon="inline-start" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function PlayerCombobox({
  players,
  selected,
  onChange,
}: {
  players: PlayerLite[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = players.filter((p) => selected.includes(p.id));
  const label =
    chosen.length === 0
      ? "All players"
      : chosen.length <= 2
        ? chosen.map(shortName).join(", ")
        : `${chosen.length} players`;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-navy-700 bg-navy-800 font-normal text-ink"
            aria-expanded={open}
          >
            {label}
            <ChevronsUpDown data-icon="inline-end" className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search players…" />
          <CommandList>
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {players.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.jersey} ${p.first} ${p.last}`}
                  onSelect={() => toggle(p.id)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selected.includes(p.id) ? "text-gold" : "invisible"
                    )}
                  />
                  <span className="w-6 text-right font-semibold text-muted-foreground tabular-nums">
                    {p.jersey}
                  </span>
                  {p.first} {p.last}
                  <span className="ml-auto text-[10px] text-muted-foreground">{p.position}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
