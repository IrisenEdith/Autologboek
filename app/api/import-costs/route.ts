import { NextRequest, NextResponse } from 'next/server';

interface CostEntry {
  date: string;
  odometer?: number;
  costType?: string;
  totalPrice?: number;
  currency?: string;
  note?: string;
}

const isConfiguredSupabaseValue = (value: string | undefined) =>
  Boolean(
    value &&
    !value.includes('your-project') &&
    !value.includes('your-') &&
    !value.includes('supabase-url') &&
    !value.includes('anon-public-key'),
  );

const isValidRow = (row: CostEntry) =>
  typeof row.date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
  (row.odometer === undefined || typeof row.odometer === 'number') &&
  (row.totalPrice === undefined || typeof row.totalPrice === 'number');

export async function POST(request: NextRequest) {
  let body: { rows?: CostEntry[]; vehicleName?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag: geen leesbare JSON ontvangen.' }, { status: 400 });
  }

  const rows = body.rows as CostEntry[] | undefined;
  const vehicleName = typeof body.vehicleName === 'string' && body.vehicleName.trim()
    ? body.vehicleName.trim()
    : 'Unknown vehicle';

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const invalidRows = rows.filter((row) => !isValidRow(row));

  if (invalidRows.length > 0) {
    return NextResponse.json({ error: `${invalidRows.length} invalid rows` }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useSupabase = isConfiguredSupabaseValue(supabaseUrl) && isConfiguredSupabaseValue(supabaseKey);

  if (!useSupabase) {
    return NextResponse.json({ message: 'Supabase not configured; JSON export is available.', count: rows.length });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase configuration is incomplete' }, { status: 500 });
  }

  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/vehicle_costs`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows.map((row) => ({
        cost_date: row.date,
        odometer: row.odometer ?? null,
        cost_type: row.costType ?? null,
        total_price: row.totalPrice ?? null,
        currency: row.currency ?? null,
        note: row.note ?? null,
        vehicle_name: vehicleName,
      }))),
    });
  } catch {
    return NextResponse.json({
      error: 'Supabase kon niet worden bereikt. Controleer je .env.local of download de data voorlopig als JSON.',
    }, { status: 502 });
  }

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: response.status });
  }

  return NextResponse.json({ message: `${rows.length} regels geimporteerd voor ${vehicleName}.`, count: rows.length });
}
