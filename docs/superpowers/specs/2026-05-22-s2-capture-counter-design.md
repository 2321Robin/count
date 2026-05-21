# S2 Capture Counter Design

## Goal

Build a deployable web app for tracking S2 creature encounter counts. The app is inspired by the referenced Roco World shiny counter concept, but focuses on S2 encounter tracking rather than generic shiny capture tracking.

## Scope

The first version will be a Vite + React + TypeScript single-page app. It will run fully in the browser, store data in `localStorage`, and require no backend, account system, or cloud sync.

Core scope:

- Track S2 creatures separately.
- Provide built-in default S2 creatures and allow custom creatures.
- Count encounter attempts, not successful captures.
- Track both current-round encounters and historical total encounters.
- Record successful target acquisition history and reset the current round afterward.
- Support local persistence, JSON export, JSON import, clear all data, and reset to defaults.
- Use a minimal utility-focused visual style optimized for fast repeated clicking.

Out of scope for the first version:

- Cloud sync.
- User accounts.
- Backend APIs.
- Charts or advanced analytics.
- Official game data scraping.

## Technical Approach

Use Vite, React, and TypeScript. The project should be deployable to GitHub Pages or Vercel without server requirements.

The app will be split into focused modules:

- Default creature data.
- Storage read/write and migration helpers.
- Counter and history business logic.
- React UI components.
- Import/export validation.

This structure keeps the first version small while leaving room for future features such as sorting, filtering, charting, or theme options.

## UI Structure

The app will use a dashboard layout:

- Top header with app title and aggregate stats.
- Main grid of creature cards.
- Dialogs or panels for editing creatures, recording history, and managing data.
- History list for reviewing recorded acquisitions.

The visual style should be minimal and tool-like:

- Large primary `+1` button for repeated use.
- Clear numeric hierarchy for current round, target progress, and total encounters.
- Responsive layout for mobile and desktop.
- Low decoration and high readability.

## Components

`App` loads state, saves state, and coordinates the page.

`HeaderStats` displays aggregate totals: creature count, current-round total encounters, historical total encounters, and recorded acquisition count.

`CreatureGrid` renders all creature cards.

`CreatureCard` shows one creature's name, target count, current encounters, total encounters, location/activity, notes summary, progress display, and actions: `+1`, `-1`, edit, and record acquisition.

`CreatureEditor` handles adding and editing creatures. Fields include name, target count, location/activity, and notes.

`RecordDialog` records an acquisition with date, round encounter count, total encounter count at record time, location/activity, and notes. Saving a record resets that creature's current-round encounters to zero and preserves historical total encounters.

`DataManager` handles JSON export, JSON import, clear all data, and reset to default data.

`HistoryList` displays acquisition records, including creature name, date, round encounters, total encounters at record time, location/activity, and notes.

## Data Model

The persisted data is a versioned JSON object.

```ts
type AppData = {
  version: 1;
  creatures: Creature[];
  records: AcquisitionRecord[];
  settings: AppSettings;
};

type Creature = {
  id: string;
  name: string;
  targetCount: number;
  currentEncounters: number;
  totalEncounters: number;
  location: string;
  notes: string;
  isDefault: boolean;
};

type AcquisitionRecord = {
  id: string;
  creatureId: string;
  creatureName: string;
  date: string;
  roundEncounters: number;
  totalEncountersAtRecord: number;
  location: string;
  notes: string;
};

type AppSettings = {
  sortMode: "default";
};
```

## Data Flow

On startup, the app loads data from `localStorage`. If no saved data exists, it initializes from default S2 creature data.

When the user clicks `+1`, the selected creature's `currentEncounters` and `totalEncounters` both increase by one.

When the user clicks `-1`, the selected creature's `currentEncounters` and `totalEncounters` decrease by one, but never below zero.

When the user records an acquisition, the app creates an `AcquisitionRecord`, stores the current round and total encounter values, then resets only `currentEncounters` for that creature.

When creature metadata changes, the app updates the creature object and persists the full data object.

All state-changing actions write the updated data back to `localStorage`.

## Data Management

Export creates a downloadable JSON backup of the full `AppData` object.

Import accepts a JSON file, validates the top-level structure and required fields, and only replaces current data if validation passes.

Clear all data removes all creatures and records after explicit confirmation.

Reset to defaults replaces creatures with the built-in default list and clears records after explicit confirmation.

## Error Handling

Invalid imports must not overwrite existing data. The UI should show a clear failure message.

If `localStorage` data is missing, malformed, or unreadable, the app should fall back to default data and keep the page usable.

Destructive operations such as clear all data and reset to defaults require confirmation.

Counter values must not become negative.

## Testing Strategy

Automated tests should cover business logic and data handling:

- Initializing from default data.
- Loading and saving app data.
- Incrementing and decrementing encounters.
- Preventing negative counts.
- Recording acquisition history.
- Resetting current-round encounters after recording.
- Preserving total encounters after recording.
- Validating import data.
- Calculating aggregate header stats.

Manual verification should cover:

- Mobile and desktop layouts.
- Fast repeated `+1` usage.
- Add, edit, and delete custom creatures.
- Export and import backup flow.
- Clear all data and reset to defaults confirmations.

## Open Implementation Detail

The exact built-in S2 creature names and default target counts can be seeded with placeholder S2 entries first, then replaced with accurate names and counts when the user provides the final list.
