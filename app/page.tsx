"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { parse } from "papaparse";

interface CostEntry {
  id: string;
  date: string;
  odometer?: number;
  trip?: number;
  quantity?: number;
  costType?: string;
  totalPrice?: number;
  currency?: string;
  chargeLevel?: number;
  note?: string;
}

type DraftEntry = {
  date: string;
  odometer: string;
  costType: string;
  totalPrice: string;
  currency: string;
  chargeLevel: string;
  note: string;
};

type SortKey = 'date' | 'odometer' | 'trip' | 'quantity' | 'costType' | 'totalPrice' | 'currency';

const emptyDraft: DraftEntry = {
  date: "",
  odometer: "",
  costType: "Onderhoud",
  totalPrice: "",
  currency: "EUR",
  chargeLevel: "",
  note: "",
};

const pickValue = (row: Record<string, string>, headers: string[]) => {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]),
  );

  for (const header of headers) {
    const value = normalizedRow[header.toLowerCase()];
    if (value !== undefined && value !== "") {
      return value.trim();
    }
  }

  return "";
};

const inferCostType = (row: Record<string, string>) => {
  const explicitType = pickValue(row, ["Cost type", "Kostentype", "Type", "Soort"]);
  const quantity = pickValue(row, ["Quantity", "Hoeveelheid"]);
  const chargeLevel = pickValue(row, ["Charge level", "Laadniveau"]);
  const fuel = pickValue(row, ["Fuel", "Brandstof"]);

  if (quantity || chargeLevel || fuel === "19") {
    return "Laden";
  }

  return explicitType;
};

const buildNote = (row: Record<string, string>) => {
  const note = pickValue(row, ["Note", "Beschrijving", "Description", "Opmerking"]);
  const quantity = pickValue(row, ["Quantity", "Hoeveelheid"]);
  const consumption = pickValue(row, ["Consumption", "Verbruik"]);
  const company = pickValue(row, ["Company", "Bedrijf"]);
  const location = pickValue(row, ["Location", "Locatie"]);
  const chargeLevel = pickValue(row, ["Charge level", "Laadniveau"]);
  const parts = [
    note,
    quantity ? `${quantity} kWh/l` : "",
    consumption ? `Verbruik: ${consumption}` : "",
    chargeLevel ? `Laadniveau start ${chargeLevel}%` : "",
    company,
    location,
  ].filter(Boolean);

  return parts.join(" | ");
};

const parseDecimal = (value: string): number | undefined => {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return undefined;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = trimmed
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (lastComma > -1) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1) {
    const decimals = trimmed.length - lastDot - 1;
    normalized = decimals === 3 ? trimmed.replace(/\./g, "") : trimmed;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDate = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parts = trimmed.split(/[./-]/);
  if (parts.length !== 3) return undefined;

  const [day, month, year] = parts.map((part) => part.trim());
  const parsedYear = year.length === 2 ? `20${year}` : year;
  if (!day || !month || !parsedYear) return undefined;

  return `${parsedYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);

const downloadJson = (fileName: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadSortableColumnsJson = (fileName: string, rows: CostEntry[]) => {
  const payload = rows.map((row) => ({
    id: row.id,
    date: row.date,
    odometer: row.odometer ?? null,
    chargeLevel: row.chargeLevel ?? null,
    quantity: row.quantity ?? null,
    costType: row.costType ?? null,
    totalPrice: row.totalPrice ?? null,
    currency: row.currency ?? null,
  }));
  downloadJson(fileName, payload);
};

export default function Home() {
  const [vehicleName, setVehicleName] = useState("Mijn voertuig");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [rows, setRows] = useState<CostEntry[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<DraftEntry>(emptyDraft);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const getSortValue = (row: CostEntry, key: SortKey) => {
    if (key === 'date') return row.date || '';
    if (key === 'odometer') return row.odometer ?? -Infinity;
    if (key === 'trip') return row.trip ?? -Infinity;
    if (key === 'quantity') return row.quantity ?? -Infinity;
    if (key === 'totalPrice') return row.totalPrice ?? -Infinity;
    return row[key]?.toString().toLowerCase() ?? '';
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      if (aValue === bValue) return 0;
      return sortDirection === 'asc'
        ? aValue < bValue ? -1 : 1
        : aValue < bValue ? 1 : -1;
    });
  }, [rows, sortKey, sortDirection]);

  const summary = useMemo(() => {
    const rowsWithPrice = rows.filter((row) => row.totalPrice !== undefined);
    const total = rowsWithPrice.reduce((sum, row) => sum + (row.totalPrice ?? 0), 0);
    const quantityRows = rows.filter((row) => row.quantity !== undefined);
    const totalQuantity = quantityRows.length
      ? quantityRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
      : undefined;
    const tripRows = rows.filter((row) => row.trip !== undefined);
    const tripDistance = tripRows.length
      ? tripRows.reduce((sum, row) => sum + (row.trip ?? 0), 0)
      : undefined;
    const odometerRows = rows.filter((row) => row.odometer !== undefined);
    const odometerCount = odometerRows.length;
    const odometerRowsWithDate = odometerRows
      .filter((row) => row.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const odometerValues = odometerRows.map((row) => row.odometer!);
    const odometerDistance =
      odometerRowsWithDate.length > 1
        ? odometerRowsWithDate[odometerRowsWithDate.length - 1].odometer! -
          odometerRowsWithDate[0].odometer!
        : odometerValues.length > 1
        ? Math.max(...odometerValues) - Math.min(...odometerValues)
        : undefined;
    const firstOdometer =
      odometerRowsWithDate.length > 0
        ? odometerRowsWithDate[0].odometer
        : odometerValues.length > 0
        ? Math.min(...odometerValues)
        : undefined;
    const latestOdometer =
      odometerRowsWithDate.length > 0
        ? odometerRowsWithDate[odometerRowsWithDate.length - 1].odometer
        : odometerValues.length > 0
        ? Math.max(...odometerValues)
        : undefined;
    const distanceSource = odometerDistance !== undefined ? "odometer" : tripDistance !== undefined ? "trip" : undefined;
    const distance = distanceSource === "odometer" ? odometerDistance : tripDistance;
    const distanceMismatch =
      odometerDistance !== undefined && tripDistance !== undefined
        ? Math.abs(odometerDistance - tripDistance)
        : undefined;
    const averageConsumption =
      totalQuantity !== undefined && distance !== undefined && distance > 0
        ? (totalQuantity / distance) * 100
        : undefined;
    const costPer100km = distance !== undefined && distance > 0 ? (total / distance) * 100 : undefined;
    const currencies = Array.from(new Set(rows.map((row) => row.currency).filter(Boolean)));
    const currency = currencies.length === 1 ? currencies[0] ?? "EUR" : "EUR";
    const sortedDates = rows
      .map((row) => row.date)
      .filter(Boolean)
      .sort();

    return {
      total,
      totalQuantity,
      averageConsumption,
      costPer100km,
      distance,
      distanceSource,
      tripDistance,
      tripCount: tripRows.length,
      odometerDistance,
      odometerCount,
      distanceMismatch,
      firstOdometer,
      latestOdometer,
      currency,
      firstDate: sortedDates[0],
      lastDate: sortedDates[sortedDates.length - 1],
      typeCount: new Set(rows.map((row) => row.costType).filter(Boolean)).size,
    };
  }, [rows]);

  const parseFile = (file: File) =>
    new Promise<CostEntry[]>((resolve, reject) => {
      parse<Record<string, string>>(file, {
        header: true,
        delimiter: "",
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = results.data
            .map((row) => {
              const entry: CostEntry = {
                date:
                  parseDate(pickValue(row, ["Date", "Datum", "Dátum", "date"])) ?? "",
                odometer: parseDecimal(
                  pickValue(row, ["Odometer", "Kilometerstand", "KM", "Mileage"]),
                ),
                trip: parseDecimal(pickValue(row, ["Trip", "Rit"])),
                costType: inferCostType(row),
                quantity: parseDecimal(pickValue(row, ["Quantity", "Hoeveelheid"])),
                totalPrice: parseDecimal(
                  pickValue(row, [
                    "Total price",
                    "Gesamtpreis",
                    "Totaalprijs",
                    "Bedrag",
                    "Price",
                  ]),
                ),
                currency:
                  pickValue(row, [
                    "Currency",
                    "Waehrung",
                    "Wahrung",
                    "Währung",
                    "WÃ¤hrung",
                    "Valuta",
                  ]) || "EUR",
                chargeLevel: parseDecimal(pickValue(row, ["Charge level", "Laadniveau"])),
                note: buildNote(row),
                id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
              };
              return entry.date ? entry : null;
            })
            .filter((entry): entry is CostEntry => entry !== null);

          resolve(parsed);
        },
        error: (err) => reject(err),
      });
    });

  const handleFiles = async (files: File[]) => {
    setError("");
    setStatus("CSV verwerken...");
    setFileNames(files.map((file) => file.name));

    try {
      const parsedRowsArrays = await Promise.all(files.map((file) => parseFile(file)));
      const combinedRows = parsedRowsArrays.flat();
      setRows((current) => [...current, ...combinedRows]);
      setStatus(`${combinedRows.length} regels gevonden in ${files.length} bestand(en)`);
      if (combinedRows.length === 0) {
        setError("Geen geldige regels gevonden. Controleer of de CSV datumkolommen bevat.");
      }
    } catch (err) {
      setError(`CSV-fout: ${err instanceof Error ? err.message : "Onbekende fout"}`);
      setStatus("");
    }
  };

  const handleFile = async (file: File) => {
    await handleFiles([file]);
  };

  const handleDraftChange =
    (field: keyof DraftEntry) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const date = parseDate(draft.date);
    const totalPrice = parseDecimal(draft.totalPrice);

    if (!date || totalPrice === undefined) {
      setError("Vul minstens een geldige datum en bedrag in.");
      return;
    }

    setRows((current) => {
      const updatedRow: CostEntry = {
        id: editingRowId ?? (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        date,
        odometer: parseDecimal(draft.odometer),
        costType: draft.costType,
        totalPrice,
        currency: draft.currency || "EUR",
        chargeLevel: parseDecimal(draft.chargeLevel),
        note: draft.note,
      };

      if (editingRowId) {
        return current.map((row) => (row.id === editingRowId ? updatedRow : row));
      }

      return [...current, updatedRow];
    });
    setEditingRowId(null);
    setDraft(emptyDraft);
    setEditingRowId(null);
    setError("");
    setStatus(editingRowId ? "Handmatige kost bijgewerkt." : "Handmatige kost toegevoegd.");
  };

  const handleEditRow = (id: string) => {
    const row = rows.find((row) => row.id === id);
    if (!row) return;

    setDraft({
      date: row.date,
      odometer: row.odometer?.toString() ?? "",
      costType: row.costType ?? "Onderhoud",
      totalPrice: row.totalPrice?.toString() ?? "",
      currency: row.currency ?? "EUR",
      chargeLevel: row.chargeLevel?.toString() ?? "",
      note: row.note ?? "",
    });
    setEditingRowId(id);
  };

  const handleDeleteRow = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    if (editingRowId === id) {
      setEditingRowId(null);
      setDraft(emptyDraft);
    }
  };

  const handleUpload = async () => {
    setError("");
    setStatus("Data verzenden...");

    try {
      const response = await fetch("/api/import-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleName, rows }),
      });
      const responseText = await response.text();
      const json = responseText ? JSON.parse(responseText) : {};
      if (!response.ok) {
        throw new Error(json.error || responseText || "Upload mislukt");
      }
      setStatus(json.message || `${json.count ?? rows.length} regels verwerkt.`);
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Vehicle Log Online</p>
          <h1>Alle voertuigkosten op een plek.</h1>
          <p className="hero-copy">
            Importeer Spritmonitor CSV-bestanden, controleer de regels en stuur ze daarna
            naar je database of bewaar ze als JSON.
          </p>
        </div>
        <div className="vehicle-panel" aria-label="Voertuig">
          <label htmlFor="vehicleName">Voertuignaam</label>
          <input
            id="vehicleName"
            value={vehicleName}
            onChange={(event) => setVehicleName(event.target.value)}
            placeholder="Bijvoorbeeld Volvo XC40"
          />
        </div>
      </section>

      <section className="stats-grid" aria-label="Samenvatting">
        <div className="stat-card">
          <span>Laatste kilometerstand</span>
          <strong>{summary.latestOdometer !== undefined ? `${summary.latestOdometer.toLocaleString("nl-BE")} km` : "-"}</strong>
          {summary.firstOdometer !== undefined && (
            <p className="stat-subtitle">
              Start: {summary.firstOdometer.toLocaleString("nl-BE")} km
            </p>
          )}
        </div>
        <div className="stat-card">
          <span>Totaal verbruik</span>
          <strong>{summary.totalQuantity !== undefined ? `${summary.totalQuantity.toLocaleString("nl-BE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kWh` : "-"}</strong>
        </div>
        <div className="stat-card">
          <span>Verbruik / 100 km</span>
          <strong>{summary.averageConsumption !== undefined ? `${summary.averageConsumption.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh` : "-"}</strong>
          {summary.distance !== undefined && summary.totalQuantity !== undefined && (
            <p className="stat-subtitle">
              {summary.distance.toLocaleString("nl-BE")} km and {summary.totalQuantity.toLocaleString("nl-BE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kWh
            </p>
          )}
        </div>
        <div className="stat-card">
          <span>Totaal kosten</span>
          <strong>{formatMoney(summary.total, summary.currency)}</strong>
        </div>
        <div className="stat-card">
          <span>Kosten / 100 km</span>
          <strong>{summary.costPer100km !== undefined ? `${formatMoney(summary.costPer100km, summary.currency)} /100 km` : "-"}</strong>
          {summary.distance !== undefined && summary.total !== undefined && (
            <p className="stat-subtitle">
              {summary.distance.toLocaleString("nl-BE")} km and {formatMoney(summary.total, summary.currency)}
            </p>
          )}
        </div>
        <div className="stat-card">
          <span>Periode</span>
          <strong>{summary.firstDate ? `${summary.firstDate} - ${summary.lastDate}` : "-"}</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>CSV import</h2>
              <p>Importeer meerdere Spritmonitor exports met datum, kilometerstand, type, bedrag en notitie.</p>
            </div>
          </div>

          <label className="file-drop">
            <span>Kies één of meer CSV-bestanden</span>
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(event) => {
                const selectedFiles = event.target.files;
                if (!selectedFiles) return;
                const files = Array.from(selectedFiles);
                handleFiles(files);
              }}
            />
          </label>

          {fileNames.length > 0 && (
            <p className="meta">Bestanden: {fileNames.join(', ')}</p>
          )}
          {status && <p className="status success">{status}</p>}
          {error && <p className="status error">{error}</p>}
        </div>

        <form className="panel manual-form" onSubmit={handleManualSubmit}>
          <div className="panel-header">
            <div>
              <h2>Handmatige kost</h2>
              <p>Voeg snel onderhoud, verzekering, keuring of een losse uitgave toe.</p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Datum
              <input type="date" value={draft.date} onChange={handleDraftChange("date")} />
            </label>
            <label>
              Kilometerstand
              <input
                inputMode="decimal"
                value={draft.odometer}
                onChange={handleDraftChange("odometer")}
                placeholder="120000"
              />
            </label>
            <label>
              Laadniveau start (%)
              <input
                inputMode="decimal"
                value={draft.chargeLevel}
                onChange={handleDraftChange("chargeLevel")}
                placeholder="19"
              />
            </label>
            <label>
              Type
              <select value={draft.costType} onChange={handleDraftChange("costType")}>
                <option>Onderhoud</option>
                <option>Brandstof</option>
                <option>Laden</option>
                <option>Verzekering</option>
                <option>Belasting</option>
                <option>Keuring</option>
                <option>Overig</option>
              </select>
            </label>
            <label>
              Bedrag
              <input
                inputMode="decimal"
                value={draft.totalPrice}
                onChange={handleDraftChange("totalPrice")}
                placeholder="89,95"
              />
            </label>
            <label>
              Valuta
              <input value={draft.currency} onChange={handleDraftChange("currency")} />
            </label>
            <label>
              Notitie
              <input value={draft.note} onChange={handleDraftChange("note")} />
            </label>
          </div>

          <button className="button secondary" type="submit">
            Kost toevoegen
          </button>
        </form>
      </section>

      <section className="table-section">
        <div className="table-header">
          <div>
            <h2>Importcontrole</h2>
            <p>{rows.length ? `${rows.length} regels klaar voor verwerking.` : "Nog geen regels ingeladen."}</p>
          </div>
          <div className="actions">
            <label>
              Sorteer op
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="date">Datum</option>
                <option value="odometer">Kilometerstand</option>
                <option value="trip">Trip</option>
                <option value="quantity">Hoeveelheid</option>
                <option value="costType">Type</option>
                <option value="totalPrice">Bedrag</option>
                <option value="currency">Valuta</option>
              </select>
            </label>
            <button
              className="button ghost"
              type="button"
              disabled={rows.length === 0}
              onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDirection === 'asc' ? 'Oplopend' : 'Aflopend'}
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={rows.length === 0}
              onClick={() => downloadJson(`${vehicleName || "vehicle"}-costs.json`, { vehicleName, rows })}
            >
              JSON downloaden
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={rows.length === 0}
              onClick={() => downloadSortableColumnsJson(`${vehicleName || "vehicle"}-sortable.json`, sortedRows)}
            >
              Sorteerbare export
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={rows.length === 0}
              onClick={() => window.print()}
            >
              Afdrukken
            </button>
            <button className="button primary" type="button" disabled={rows.length === 0} onClick={handleUpload}>
              Upload naar database
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Kilometerstand</th>
                <th>Laadniveau</th>
                <th>Trip</th>
                <th>Hoeveelheid</th>
                <th>Type</th>
                <th>Bedrag</th>
                <th>Notitie</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Upload één of meer CSV-bestanden of voeg handmatig een kost toe.
                  </td>
                </tr>
              ) : (
                sortedRows.slice(0, 50).map((row, index) => (
                  <tr key={`${row.date}-${row.odometer ?? "no-km"}-${index}`}>
                    <td>{row.date}</td>
                    <td>{row.odometer?.toLocaleString("nl-BE") ?? "-"}</td>
                    <td>{row.chargeLevel !== undefined ? `${row.chargeLevel.toLocaleString("nl-BE")} %` : "-"}</td>
                    <td>{row.trip?.toLocaleString("nl-BE") ?? "-"}</td>
                    <td>{row.quantity?.toLocaleString("nl-BE") ?? "-"}</td>
                    <td>{row.costType || "-"}</td>
                    <td>
                      {row.totalPrice !== undefined
                        ? formatMoney(row.totalPrice, row.currency || summary.currency)
                        : "-"}
                    </td>
                    <td>{row.note || "-"}</td>
                    <td>
                      <button className="button ghost" type="button" onClick={() => handleEditRow(row.id)}>
                        Bewerken
                      </button>
                      <button className="button ghost" type="button" onClick={() => handleDeleteRow(row.id)}>
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 50 && <p className="meta">Alleen de eerste 50 regels worden getoond.</p>}
      </section>
    </main>
  );
}
