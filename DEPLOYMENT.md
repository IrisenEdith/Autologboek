# Deployment

## Voorbereiding

1. Voeg alle wijzigingen toe:
   ```bash
   git add .
   git commit -m "Initial project setup for deployment"
   ```

2. Maak een GitHub repository aan en koppel deze repository:
   ```bash
   git remote add origin <git_remote_url>
   git branch -M main
   git push -u origin main
   ```

## Vercel

1. Ga naar https://vercel.com and log in.
2. Klik op "New Project".
3. Koppel je GitHub repo.
4. Gebruik standaardinstellingen voor Next.js:
   - Build command: `npm run build`
   - Output directory: `.next`
5. Deploy.

## Netlify

1. Ga naar https://app.netlify.com en log in.
2. Klik op "New site from Git".
3. Koppel je GitHub repo.
4. Netlify detecteert `netlify.toml` automatisch:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Deploy.

## Omgevingvariabelen

Voeg in je hosting dashboard de volgende variabelen toe wanneer je Supabase wilt gebruiken:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Zonder Supabase

De app werkt ook zonder Supabase. Gebruik dan de JSON export-knop in de app.

## Mobiele app

Wanneer je een mobiele app wilt maken, kun je later kiezen voor:

- Capacitor of Ionic voor een native wrapper
- React Native met Expo
- Een PWA met `manifest.json` en service worker
