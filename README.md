# Kalendarski 📅

A modern web-based calendar application with dynamic weather integration, inspired by macOS Calendar design.

## ✨ Features

### Core Calendar Features
- **macOS-inspired Design**: Clean, modern interface that mimics the native macOS Calendar app
- **Multiple View Types**: Month, week, day and agenda views
- **Event Management**: Create, edit, and delete events with full CRUD operations
- **Calendar Organization**: Support for multiple calendars with color coding
- **Responsive Design**: Works seamlessly across desktop and mobile devices

### Weather Integration
- **Dynamic Weather Heatmap**: Background visualization that changes based on current weather conditions
- **Real-time Weather Data**: Powered by Open-Meteo with hourly forecasts, no API key
- **Location-based**: Automatically detects user location for accurate weather data
- **Temperature Color Mapping**:
  - Night hours: Blue tones
  - Day hours: Gradient from blue to red based on temperature
  - Smooth transitions between time periods
- **Weather Animations**: Subtle particle effects and overlays based on weather conditions

### Technical Features
- **Modern React Architecture**: Built with React 19, TypeScript, and Vite 7
- **State Management**: Context API for global state management
- **Caching System**: Intelligent weather data caching to minimize API calls
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Accessibility**: ARIA labels and keyboard navigation support

## 🚀 Quick Start

### Prerequisites
- Node.js 20.19+
- npm or yarn

No API keys required — weather and geocoding both use keyless providers.

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kalendarski
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional — all values have defaults)
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_APP_NAME` | Application name | No |
| `VITE_APP_VERSION` | Application version | No |
| `VITE_DEV_MODE` | Development mode flag | No |

### External services

All keyless, all called directly from the browser:

| Service | Used for |
|---------|----------|
| [Open-Meteo](https://open-meteo.com/) | Forecast, historical weather, geocoding search |
| [BigDataCloud](https://www.bigdatacloud.com/) | Reverse geocoding (coordinates → city name) |

Calendar subscriptions additionally route through this app's own `/api/ics-proxy`
function, because remote `.ics` hosts do not send CORS headers.

## 🎨 Weather Heatmap System

The weather heatmap creates a dynamic background that visualizes temperature and weather conditions:

### Color Mapping
- **Very Cold** (-20°C and below): Deep blue (#1e3a8a)
- **Cold** (0°C): Blue (#3b82f6)
- **Cool** (10°C): Cyan (#06b6d4)
- **Mild** (20°C): Green (#10b981)
- **Warm** (25°C): Amber (#f59e0b)
- **Hot** (30°C): Red (#ef4444)
- **Very Hot** (35°C+): Dark red (#dc2626)

### Night Mode Adjustments
During night hours, colors are automatically adjusted to darker, more blue-toned variants for better visual appeal.

### Weather Effects
- **Rain**: Diagonal line patterns with animation
- **Snow**: Animated snowflake particles
- **Clouds**: Soft radial gradients with gentle movement
- **Clear**: Clean gradient backgrounds

## 📱 Roadmap

The continuous colour-gradient month heatmap is the product identity — everything below is
built around it, not over it.

### Shipped

- [x] Month, week, day and agenda views
- [x] Keyless weather via Open-Meteo, behind a swappable provider interface
- [x] Per-event location weather (geocoding autocomplete on the location field)
- [x] Persisted location — no geolocation re-prompt on reload
- [x] iCal import/export (RRULE, EXDATE, overrides, timezones, all-day)
- [x] Calendar subscriptions by URL, through an SSRF-hardened proxy
- [x] Installable PWA — boots and renders the gradient fully offline
- [x] Accessibility pass: focus traps, ESC-to-close, `prefers-reduced-motion`
- [x] Error boundary, lazy-loaded iCal parser, zero tracking ([PRIVACY.md](PRIVACY.md))

### Next (no backend required)

- [ ] **Recurring events for locally created events** — `RecurrenceRule` exists in the type
      but nothing reads it, so imported calendars can repeat and yours cannot
- [ ] Search and filtering across events
- [ ] Drag-and-drop event management
- [ ] Week view: render a spanning event as one block instead of one chip per hour
- [ ] Header layout below ~360px
- [ ] Run Lighthouse against a deploy to confirm the ≥90 / ≥95 gates

### Blocked on a backend

Netlify Functions and `server/` are already scaffolded, so these are not a cold start —
but each needs real infrastructure and secrets.

- [ ] Google Calendar sync (OAuth — needs a server-side client secret and token storage)
- [ ] CalDAV integration (needs a proxy)
- [ ] Event reminders and push notifications (needs a push service; deliberately deferred
      rather than shipping notifications that only fire while the tab is open)
- [ ] Accounts and cross-device sync

### Non-goals

Tasks, habits, AI scheduling, team collaboration, and chat. Kalendarski is a calendar with
weather, and stays one.

## 🛠️ Development

### Project Structure
```
src/
├── components/               # React components
│   ├── Calendar.tsx          # Month/week/day/agenda views
│   ├── MainLayout.tsx        # Application layout and header
│   ├── EventModal.tsx        # Event create/edit dialog
│   ├── LocationPicker.tsx    # Location search popover
│   ├── SubscriptionManager.tsx # Remote .ics subscriptions
│   └── ...
├── contexts/                 # React contexts
│   └── AppContext.tsx        # Global state management
├── hooks/
│   └── useDialog.ts          # Focus trap, ESC-close, focus restore
├── services/
│   ├── weatherProvider.ts    # Provider interface + active provider
│   ├── openMeteoService.ts   # Open-Meteo forecast/geocoding
│   ├── icsService.ts         # iCal parse/build (lazy-loaded)
│   └── subscriptionService.ts # Subscription fetch via proxy
├── types/index.ts            # All type definitions
└── utils/weatherHeatmap.ts   # Gradient/heatmap logic

server/                       # Framework-agnostic proxy core
netlify/functions/            # Netlify wrapper → /api/ics-proxy
scripts/dev-server.mjs        # Dep-free dist server + proxy, for verification
public/sw.js                  # Hand-rolled service worker
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Weather data provided by [Open-Meteo](https://open-meteo.com/)
- Reverse geocoding by [BigDataCloud](https://www.bigdatacloud.com/)
- Icons by [Lucide React](https://lucide.dev/)
- Design inspiration from macOS Calendar
- Built with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/)

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include your environment details and steps to reproduce

---

**Kalendarski** - Making calendar management beautiful and weather-aware! 🌤️📅
