"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "@/lib/auth-client";
import { MapPin } from "lucide-react";
import AppBottomNav from "@/components/AppBottomNav";
import Navbar from "@/components/Navbar";
import ItemCard from "@/components/ItemCard";
import { auth } from "@/lib/firebase";
import {
  getDefaultListingLocation,
  normalizeLocationName,
  readStoredUserLocation,
  requestCurrentSupportedLocation,
} from "@/lib/location";
import { isListingVisibleInMarketplace, Listing, subscribeListings } from "@/lib/marketplace";

export default function NearbyDiscoverPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState(() => readStoredUserLocation()?.name || getDefaultListingLocation());

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setCurrentUserId(user?.uid ?? null));
  }, []);

  useEffect(() => {
    const storedLocation = readStoredUserLocation();
    if (storedLocation?.name) {
      return;
    }

    requestCurrentSupportedLocation()
      .then((location) => setSelectedLocation(location.name))
      .catch(() => {
        setSelectedLocation("");
      });
  }, []);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setItems(rows));
    return () => unsub();
  }, []);

  const nearbyItems = useMemo(() => {
    return items
      .filter((item) => item.ownerId !== currentUserId)
      .filter((item) => isListingVisibleInMarketplace(item))
      .filter((item) => (item.type || "article") === "article")
      .filter((item) => !selectedLocation || normalizeLocationName(item.location) === normalizeLocationName(selectedLocation))
      .map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        type: item.type || "article",
        location: item.location,
        image: item.image,
        sellerId: item.ownerId,
        sellerName: item.ownerName,
        sellerAvatar: item.ownerAvatar,
        createdAt: item.createdAt,
      }));
  }, [currentUserId, items, selectedLocation]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar activeTab="cerca-de-ti" />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-24">
        <div className="mb-5 flex items-center gap-2 text-sm text-neutral-400">
          <MapPin className="h-4 w-4 text-orange-400" />
          {selectedLocation ? (
            <span>Mostrando publicaciones cerca de {selectedLocation}</span>
          ) : (
            <span>No pudimos detectar tu ubicación actual todavía.</span>
          )}
        </div>

        {nearbyItems.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 px-4 py-5 text-sm text-neutral-300">
            {selectedLocation
              ? `No hay publicaciones cerca de ${selectedLocation} ahora mismo.`
              : "Activa tu ubicación para ver publicaciones cerca de ti."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <AppBottomNav active="discover" />
    </div>
  );
}
