"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, MapPin, Search, XCircle } from "lucide-react";
import {
  getLocationOptionsForCountry,
  getSignedUpCountry,
  requestCurrentSupportedLocation,
} from "@/lib/location";

type Props = {
  open: boolean;
  currentLocation: string;
  onClose: () => void;
  onSelect: (location: string) => void;
};

export default function LocationPickerModal({
  open,
  currentLocation,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const countryName = useMemo(() => getSignedUpCountry(), []);
  const locationOptions = useMemo(() => getLocationOptionsForCountry(countryName), [countryName]);

  const filteredLocations = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return locationOptions;

    return locationOptions.filter(
      (option) =>
        option.name.toLowerCase().includes(term) || option.detail.toLowerCase().includes(term)
    );
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-neutral-950 text-neutral-50">
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-5 pt-4">
        <header className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold tracking-tight">Search Location</h2>
        </header>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-3">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar provincia o estado"
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
          />
          {!!query && (
            <button
              onClick={() => setQuery("")}
              className="text-red-400"
              aria-label="Clear"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            setDetectingLocation(true);
            setLocationError("");

            try {
              const location = await requestCurrentSupportedLocation();
              onSelect(location.name);
              onClose();
            } catch (error) {
              const message = error instanceof Error ? error.message : "";
              if (message === "location/permission-denied" || message === "User denied Geolocation") {
                setLocationError("Debes permitir acceso a ubicación para usar tu ubicación actual.");
              } else {
                setLocationError("No pudimos detectar tu ubicación actual.");
              }
            } finally {
              setDetectingLocation(false);
            }
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-400/40 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300 hover:bg-orange-500/15"
        >
          {detectingLocation ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {detectingLocation ? "Detectando ubicación..." : "Usar mi ubicación actual"}
        </button>

        {locationError ? (
          <div className="mt-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
            {locationError}
          </div>
        ) : null}

        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {countryName}
          </div>
          {filteredLocations.map((location) => {
            const isCurrent = location.name === currentLocation;

            return (
              <button
                key={location.name}
                type="button"
                onClick={() => {
                  onSelect(location.name);
                  onClose();
                }}
                className="flex w-full items-start gap-3 border-b border-neutral-800 py-3 text-left"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-tight text-neutral-50">
                    {location.name}
                  </div>
                  <div className="mt-1 text-sm leading-tight text-neutral-400">{location.detail}</div>
                  {isCurrent && (
                    <div className="mt-2 inline-flex rounded-full bg-orange-400 px-3 py-1 text-xs font-medium text-black">
                      Current location
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-5 text-center text-sm text-neutral-300">
              No locations found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
