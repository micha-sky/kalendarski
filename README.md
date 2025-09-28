# Kalendarski 📅

A modern web-based calendar application with dynamic weather integration, inspired by macOS Calendar design.

## ✨ Features

### Core Calendar Features
- **macOS-inspired Design**: Clean, modern interface that mimics the native macOS Calendar app
- **Multiple View Types**: Month, week, and day views (week and day views coming soon)
- **Event Management**: Create, edit, and delete events with full CRUD operations
- **Calendar Organization**: Support for multiple calendars with color coding
- **Responsive Design**: Works seamlessly across desktop and mobile devices

### Weather Integration
- **Dynamic Weather Heatmap**: Background visualization that changes based on current weather conditions
- **Real-time Weather Data**: Powered by OpenWeatherMap API with hourly forecasts
- **Location-based**: Automatically detects user location for accurate weather data
- **Temperature Color Mapping**:
  - Night hours: Blue tones
  - Day hours: Gradient from blue to red based on temperature
  - Smooth transitions between time periods
- **Weather Animations**: Subtle particle effects and overlays based on weather conditions

### Technical Features
- **Modern React Architecture**: Built with React 18, TypeScript, and Vite
- **State Management**: Context API for global state management
- **Caching System**: Intelligent weather data caching to minimize API calls
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Accessibility**: ARIA labels and keyboard navigation support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- OpenWeatherMap API key (free at [openweathermap.org](https://openweathermap.org/api))

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

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenWeatherMap API key:
   ```env
   VITE_OPENWEATHER_API_KEY=your-api-key-here
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
| `VITE_OPENWEATHER_API_KEY` | OpenWeatherMap API key | Yes |
| `VITE_APP_NAME` | Application name | No |
| `VITE_APP_VERSION` | Application version | No |
| `VITE_DEV_MODE` | Development mode flag | No |

### Getting an OpenWeatherMap API Key

1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to API keys section
4. Generate a new API key
5. Add it to your `.env` file

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

## 📱 Future Roadmap

### Immediate (v1.1)
- [ ] Week view implementation
- [ ] Day view implementation
- [ ] Event recurring patterns
- [ ] Calendar import/export (iCal format)

### Short-term (v1.2)
- [ ] CalDAV integration for external calendars
- [ ] Event reminders and notifications
- [ ] Drag-and-drop event management
- [ ] Search and filtering

### Long-term (v2.0)
- [ ] Progressive Web App (PWA) support
- [ ] iOS app development
- [ ] Offline functionality
- [ ] Team collaboration features
- [ ] Integration with popular calendar services

## 🛠️ Development

### Project Structure
```
src/
├── components/          # React components
│   ├── Calendar.tsx     # Main calendar component
│   ├── MainLayout.tsx   # Application layout
│   ├── Sidebar.tsx      # Navigation sidebar
│   └── ...
├── contexts/            # React contexts
│   └── AppContext.tsx   # Global state management
├── services/            # API services
│   └── weatherService.ts # Weather API integration
├── types/               # TypeScript type definitions
│   └── index.ts         # All type definitions
├── utils/               # Utility functions
│   └── weatherHeatmap.ts # Weather visualization logic
└── ...
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Weather data provided by [OpenWeatherMap](https://openweathermap.org/)
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
