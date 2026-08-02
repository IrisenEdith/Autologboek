# Vehicle Log Online

Een starterproject voor een online voertuigkosten-app met Spritmonitor CSV-import.

## Wat deze starter biedt

- Supabase-authenticatie (email login / magic link)
- CSV-import voor Spritmonitor kostenbestanden
- preview van ingevoerde kosten/onderhoud
- API-route om data naar Supabase te schrijven
- export naar JSON als Supabase nog niet is geconfigureerd

## Installatie

1. Open `C:\Users\Iris\projects\vehicle-log-online`
2. Voer uit:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`

## Supabase setup

Maak een Supabase-project en voeg deze variabelen toe in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Voorbeeld database-schema

```sql
create table vehicle_costs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_name text not null,
  cost_date date not null,
  odometer numeric,
  cost_type text,
  total_price numeric,
  currency text,
  note text,
  created_at timestamptz default now()
);
```

## CSV import formaat

Deze app ondersteunt de Spritmonitor-kostenexport met kolommen:

- `Date`
- `Odometer`
- `Cost type`
- `Total price`
- `Currency`
- `Note`

## Volgende stappen

- voeg tank/ladingsdata toe via handmatige invoer of een extra parser
- breid het model uit met `vehicles`, `fuel_entries`, `maintenance`
- maak Supabase RLS-regels voor gebruikersbewaking
