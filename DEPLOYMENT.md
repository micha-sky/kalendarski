# Deployment Guide for Kalendarski

This guide covers various deployment options for the Kalendarski calendar application.

## 🚀 Quick Deployment Options

### 1. Vercel (Recommended)

Vercel provides the easiest deployment experience for Vite applications.

#### Steps:
1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository
   - Configure environment variables:
     - `VITE_OPENWEATHER_API_KEY`: Your OpenWeatherMap API key

3. **Automatic Deployments**
   - Every push to main branch will trigger a new deployment
   - Preview deployments for pull requests

### 2. Netlify

#### Steps:
1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Visit [netlify.com](https://netlify.com)
   - Drag and drop the `dist` folder to deploy
   - Or connect your GitHub repository for automatic deployments

3. **Environment Variables**
   - Go to Site Settings > Environment Variables
   - Add `VITE_OPENWEATHER_API_KEY`

### 3. GitHub Pages

#### Steps:
1. **Install gh-pages**
   ```bash
   npm install -D gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/kalendarski",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

4. **Configure GitHub Pages**
   - Go to repository Settings > Pages
   - Select `gh-pages` branch as source

## 🔧 Build Configuration

### Environment Variables for Production

Create a `.env.production` file:
```env
VITE_OPENWEATHER_API_KEY=your-production-api-key
VITE_APP_NAME=Kalendarski
VITE_APP_VERSION=1.0.0
VITE_DEV_MODE=false
```

### Build Optimization

The application is already optimized for production with:
- **Tree shaking**: Unused code is automatically removed
- **Code splitting**: Dynamic imports for better loading performance
- **Asset optimization**: Images and CSS are minified
- **Gzip compression**: Enabled by default on most hosting platforms

### Build Command
```bash
npm run build
```

This creates a `dist` folder with optimized production files.

## 🌐 Custom Domain Setup

### For Vercel:
1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

### For Netlify:
1. Go to Site Settings > Domain Management
2. Add custom domain
3. Configure DNS records

## 📊 Performance Monitoring

### Recommended Tools:
- **Vercel Analytics**: Built-in performance monitoring
- **Google Analytics**: User behavior tracking
- **Sentry**: Error monitoring and performance tracking

### Adding Sentry (Optional):
```bash
npm install @sentry/react @sentry/tracing
```

## 🔒 Security Considerations

### API Key Security:
- Never commit API keys to version control
- Use environment variables for all sensitive data
- Consider implementing a backend proxy for API calls in production

### Content Security Policy:
Add to your hosting platform's headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.openweathermap.org;
```

## 🚨 Troubleshooting

### Common Issues:

1. **Tailwind CSS PostCSS Error**
   - If you see a PostCSS plugin error, ensure `@tailwindcss/postcss` is installed:
   ```bash
   npm install -D @tailwindcss/postcss
   ```
   - Verify `postcss.config.js` uses `'@tailwindcss/postcss': {}`

2. **API Key Not Working**
   - Verify the API key is correctly set in environment variables
   - Check that the variable name matches `VITE_OPENWEATHER_API_KEY`
   - Ensure the API key is active on OpenWeatherMap

3. **Build Failures**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check for TypeScript errors: `npm run build`
   - Verify all dependencies are installed

3. **Routing Issues (SPA)**
   - Configure your hosting platform for SPA routing
   - For Netlify: Create `_redirects` file with `/* /index.html 200`
   - For Vercel: This is handled automatically

4. **Weather Data Not Loading**
   - Check browser console for CORS errors
   - Verify geolocation permissions are granted
   - Test API key with a direct API call

### Debug Mode:
Set `VITE_DEV_MODE=true` in production to enable additional logging.

## 📈 Scaling Considerations

### For High Traffic:
1. **CDN**: Use a CDN for static assets
2. **Caching**: Implement proper cache headers
3. **API Rate Limiting**: Monitor OpenWeatherMap API usage
4. **Backend Proxy**: Consider proxying weather API calls through your backend

### Database Integration:
For persistent calendar data, consider:
- **Supabase**: PostgreSQL with real-time features
- **Firebase**: NoSQL with real-time sync
- **PlanetScale**: Serverless MySQL

## 🔄 CI/CD Pipeline

### GitHub Actions Example:
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:run
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📱 PWA Deployment (Future)

For Progressive Web App features:
1. Install Vite PWA plugin
2. Configure service worker
3. Add web app manifest
4. Enable offline functionality

---

**Need help?** Check the main README.md or create an issue in the repository.
