import React, { useEffect, useRef, useState } from 'react';
import { Driver, Merchant } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* 
  NOTE: This component handles both Real Google Maps (if API key present) 
  and a high-fidelity Leaflet Map for the "satellite view" requested.
*/

declare global {
  interface Window {
    google: any;
  }
}

interface MapProps {
  drivers: Driver[];
  merchants: Merchant[];
  selectedDriverId: string | null;
  onSelectDriver: (id: string) => void;
  draftLocation?: { lat: number; lng: number };
  showOnlyActiveDestination?: boolean;
}

type MapType = 'standard' | 'satellite' | 'terrain';

export const Map: React.FC<MapProps> = ({ drivers, merchants, selectedDriverId, onSelectDriver, draftLocation, showOnlyActiveDestination }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any | null>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const merchantMarkersRef = useRef<{ [id: string]: any }>({});
  const destinationMarkersRef = useRef<{ [id: string]: any }>({});
  const draftMarkerRef = useRef<any>(null);
  const infoWindowsRef = useRef<{ [id: string]: any }>({});
  const lastOpenedDestRef = useRef<string | null>(null);
  const manuallyClosedDestsRef = useRef<Set<string>>(new Set());
  const [apiLoaded, setApiLoaded] = useState(false);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [recenterCount, setRecenterCount] = useState(0);

  // Check if Google Maps is available
  useEffect(() => {
    if (window.google && window.google.maps) {
      setApiLoaded(true);
    } else {
      // Check periodically (since index.html might load it async)
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          setApiLoaded(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  // Initialize Google Map
  useEffect(() => {
    if (apiLoaded && mapRef.current && !mapInstance) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 17.0746, lng: -61.8175 }, // Centered on Antigua
        zoom: 12,
        mapTypeId: 'roadmap',
        styles: [
          { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
          },
          {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
          },
        ],
        disableDefaultUI: true,
      });

      setMapInstance(map);
    }
  }, [apiLoaded, mapInstance]);

  // Handle map type changes
  useEffect(() => {
    if (mapInstance && apiLoaded) {
      const type = mapType === 'standard' ? 'roadmap' : 
                   mapType === 'satellite' ? 'hybrid' : 'terrain';
      mapInstance.setMapTypeId(type);
      
      // Remove styles if not standard to let google defaults show better for satellite/terrain
      if (mapType !== 'standard') {
        mapInstance.setOptions({ styles: [] });
      } else {
        mapInstance.setOptions({ 
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#212a37" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
          ]
        });
      }
    }
  }, [mapType, mapInstance, apiLoaded]);

  // Update Google Map Markers
  useEffect(() => {
    if (!mapInstance || !apiLoaded) return;

    const bounds = new window.google.maps.LatLngBounds();
    let hasMarkers = false;

    drivers?.forEach(driver => {
      // If offline or invalid coordinates, remove marker
      if (!driver.isOnline || typeof driver.latitude !== 'number' || typeof driver.longitude !== 'number' || isNaN(driver.latitude) || isNaN(driver.longitude)) {
        if (markersRef.current[driver.id]) {
          markersRef.current[driver.id].setMap(null);
          delete markersRef.current[driver.id];
        }
        return;
      }

      const position = { lat: driver.latitude, lng: driver.longitude };
      const isSelected = driver.id === selectedDriverId;
      const color = getStatusColor(driver.status);
        
        // Define Custom Icon for Google Maps
        const iconSize = isSelected ? 52 : 40;
        const truckPath = "M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z";
        
        // Create a custom SVG data URL
        const svg = `
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="rgba(15, 23, 42, 0.9)" stroke="${color}" stroke-width="2" />
            <path d="${truckPath}" fill="${color}" transform="scale(0.6) translate(8, 8)" />
          </svg>
        `;
        
        const googleIcon = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new window.google.maps.Size(iconSize, iconSize),
          anchor: new window.google.maps.Point(iconSize/2, iconSize/2),
          labelOrigin: new window.google.maps.Point(iconSize/2, iconSize + 10)
        };

        if (markersRef.current[driver.id]) {
          // Update existing
          const pos = new window.google.maps.LatLng(position.lat, position.lng);
          markersRef.current[driver.id].setPosition(pos);
          markersRef.current[driver.id].setIcon(googleIcon);
          markersRef.current[driver.id].setZIndex(isSelected ? 1000 : 100);
          markersRef.current[driver.id].setLabel({
            text: isSelected ? driver.name : '',
            color: color,
            fontSize: '11px',
            fontWeight: 'bold',
            className: 'marker-label'
          });
          bounds.extend(pos);
          hasMarkers = true;
        } else {
          // Create new
          const pos = new window.google.maps.LatLng(position.lat, position.lng);
          const marker = new window.google.maps.Marker({
            position: pos,
            map: mapInstance,
            title: driver.name,
            icon: googleIcon,
            zIndex: isSelected ? 1000 : 100,
            label: {
              text: isSelected ? driver.name : '',
              color: color,
              fontSize: '11px',
              fontWeight: 'bold',
              className: 'marker-label'
            }
          });
          bounds.extend(pos);
          hasMarkers = true;
        
        marker.addListener("click", () => {
          onSelectDriver(driver.id);
        });

        markersRef.current[driver.id] = marker;
      }
    });

    // Cleanup removed drivers
    Object.keys(markersRef.current).forEach(id => {
      if (!drivers?.find(d => d.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    // Handle Merchant Markers (Only if not filtering for driver)
    if (!showOnlyActiveDestination) {
      merchants?.forEach(merchant => {
        if (isNaN(merchant.latitude) || isNaN(merchant.longitude)) return;
        const pos = { lat: merchant.latitude, lng: merchant.longitude };
        const latLng = new window.google.maps.LatLng(pos.lat, pos.lng);
        bounds.extend(latLng);
        hasMarkers = true;
        
        const storeSvg = `
          <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="20" height="16" rx="3" fill="#64748b" stroke="white" stroke-width="2" />
            <path d="M12 7V17M12 7L9 10M12 7L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        `;

        if (merchantMarkersRef.current[merchant.id]) {
          merchantMarkersRef.current[merchant.id].setPosition(pos);
        } else {
          const marker = new window.google.maps.Marker({
            position: pos,
            map: mapInstance,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(storeSvg)}`,
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 16)
            },
            title: merchant.name,
            zIndex: 500
          });
          merchantMarkersRef.current[merchant.id] = marker;
        }
      });
    }

    // Cleanup Merchant Markers
    Object.keys(merchantMarkersRef.current).forEach(id => {
      // If we are filtering, remove all non-active ones
      if (showOnlyActiveDestination || !merchants?.find(m => m.id === id)) {
        merchantMarkersRef.current[id].setMap(null);
        delete merchantMarkersRef.current[id];
      }
    });

    // Handle Destination Markers (Store Icons)
    const activeDestinations: Set<string> = new Set();
    
    // Only show destination for SELECTED driver to reduce clutter
    const selectedDriver = drivers?.find(d => d.id === selectedDriverId);
    if (selectedDriver && selectedDriver.isOnline && selectedDriver.cargo) {
      const nextItem = selectedDriver.cargo.find(c => c.status !== 'DELIVERED');
      if (nextItem) {
        const merchant = merchants?.find(m => m.id === nextItem.merchantId);
        if (merchant && !isNaN(merchant.latitude) && !isNaN(merchant.longitude)) {
          const destKey = `dest-${selectedDriver.id}-${merchant.id}-${nextItem.id}`;
          activeDestinations.add(destKey);
          
          const pos = { lat: merchant.latitude, lng: merchant.longitude };
          
          const infoContent = `
            <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
              <div style="color: #ef4444; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px;">
                Next Destination
              </div>
              <div style="color: #1e293b; font-size: 16px; font-weight: 700; margin-bottom: 2px; white-space: normal;">
                ${merchant.name}
              </div>
              <div style="color: #64748b; font-size: 12px; margin-bottom: 12px;">
                ${merchant.sector}
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}" 
                 target="_blank" 
                 style="display: block; width: 100%; text-align: center; background: #ef4444; color: white; text-decoration: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; box-sizing: border-box;">
                NAVIGATE
              </a>
            </div>
          `;

          if (destinationMarkersRef.current[destKey]) {
            const marker = destinationMarkersRef.current[destKey];
            marker.setPosition(pos);
            if (infoWindowsRef.current[destKey]) {
              infoWindowsRef.current[destKey].setContent(infoContent);
              if (lastOpenedDestRef.current !== destKey && !manuallyClosedDestsRef.current.has(destKey)) {
                infoWindowsRef.current[destKey].open(mapInstance, marker);
                lastOpenedDestRef.current = destKey;
              }
            }
          } else {
            const marker = new window.google.maps.Marker({
              position: pos,
              map: mapInstance,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2,
                scale: 8
              },
              zIndex: 2000, 
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: infoContent,
              pixelOffset: new window.google.maps.Size(0, -10)
            });

            if (lastOpenedDestRef.current !== destKey && !manuallyClosedDestsRef.current.has(destKey)) {
              infoWindow.open(mapInstance, marker);
              lastOpenedDestRef.current = destKey;
            }

            infoWindow.addListener('closeclick', () => {
              manuallyClosedDestsRef.current.add(destKey);
            });

            marker.addListener("click", () => {
              manuallyClosedDestsRef.current.delete(destKey);
              infoWindow.open(mapInstance, marker);
            });

            destinationMarkersRef.current[destKey] = marker;
            infoWindowsRef.current[destKey] = infoWindow;
          }
        }
      }
    }

    // Cleanup destination markers
    Object.keys(destinationMarkersRef.current).forEach(key => {
      if (!activeDestinations.has(key)) {
        destinationMarkersRef.current[key].setMap(null);
        delete destinationMarkersRef.current[key];
        if (infoWindowsRef.current[key]) {
          infoWindowsRef.current[key].close();
          delete infoWindowsRef.current[key];
        }
      }
    });

    // Auto-fit bounds if no driver selected and we have markers
    if (hasMarkers && !selectedDriverId && recenterCount === 0) {
      mapInstance.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }

  }, [drivers, merchants, mapInstance, selectedDriverId, onSelectDriver, apiLoaded, recenterCount]);

  // Handle Draft Marker (for location picking or link auto-fill)
  useEffect(() => {
    if (!mapInstance || !apiLoaded) return;

    if (draftLocation) {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.setPosition(draftLocation);
      } else {
        const draftSvg = `
          <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4f46e5" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="9" r="3" fill="white"/>
          </svg>
        `;
        draftMarkerRef.current = new window.google.maps.Marker({
          position: draftLocation,
          map: mapInstance,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(draftSvg)}`,
            scaledSize: new window.google.maps.Size(40, 40),
            anchor: new window.google.maps.Point(20, 40)
          },
          zIndex: 3000,
          animation: window.google.maps.Animation.BOUNCE,
          title: 'Draft Location'
        });
      }
    } else if (draftMarkerRef.current) {
      draftMarkerRef.current.setMap(null);
      draftMarkerRef.current = null;
    }
  }, [mapInstance, apiLoaded, draftLocation]);

  // Pan to selected driver (Google Maps)
  useEffect(() => {
    if (!mapInstance || !selectedDriverId) return;
    
    const driver = drivers?.find(d => d.id === selectedDriverId);
    if (driver && driver.isOnline && !isNaN(driver.latitude) && !isNaN(driver.longitude)) {
      mapInstance.panTo({ lat: driver.latitude, lng: driver.longitude });
      mapInstance.setZoom(15);
    }
  }, [selectedDriverId, recenterCount, mapInstance, apiLoaded]);

  const getStatusColor = (status: string) => {
    let color = '#00f0ff'; // Cyan
    if (status === 'DELIVERED') color = '#39ff14'; // Neon Green
    else if (status === 'DELAYED') color = '#ff00ff'; // Magenta
    return color;
  };

  const getStoreIcon = () => {
    // Store/Shopping Bag Path
    const storePath = "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-8-2h4v2h-4V4zm8 14H4V8h16v10z";
    
    return {
      path: storePath,
      fillColor: '#ef4444', // Red Store Icon
      fillOpacity: 1,
      strokeWeight: 1.5,
      strokeColor: "#000000",
      scale: 1.2,
      anchor: new window.google.maps.Point(12, 12)
    };
  };

  if (!apiLoaded) {
    // Use Leaflet for Satellite View
    return (
      <LeafletMap 
        drivers={drivers} 
        merchants={merchants} 
        selectedDriverId={selectedDriverId} 
        onSelectDriver={onSelectDriver} 
        draftLocation={draftLocation}
        showOnlyActiveDestination={showOnlyActiveDestination}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      <MapToggle current={mapType} onChange={setMapType} />
      
      {/* Recenter Button */}
      {selectedDriverId && (
        <button 
          onClick={() => setRecenterCount(prev => prev + 1)}
          className="absolute bottom-6 right-4 z-[1000] p-3 rounded-full shadow-2xl transition-all border bg-slate-900/90 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800"
          title="Recenter to Driver"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  );
};

// --- LEAFLET SATELLITE MAP ---
const LeafletMap: React.FC<MapProps> = ({ drivers, merchants, selectedDriverId, onSelectDriver, draftLocation, showOnlyActiveDestination }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const merchantMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const destMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const lastOpenedDestRef = useRef<string | null>(null);
  const manuallyClosedDestsRef = useRef<Set<string>>(new Set());
  const tilesRef = useRef<L.TileLayer | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [recenterCount, setRecenterCount] = useState(0);

  // Initialize Leaflet
  useEffect(() => {
    let leafletInstance: L.Map | null = null;
    
    if (mapContainerRef.current && !map) {
      leafletInstance = L.map(mapContainerRef.current, {
        center: [17.120, -61.820], // St. John's (Merchant cluster)
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      setMap(leafletInstance);
    }

    return () => {
      if (leafletInstance) {
        leafletInstance.remove();
        setMap(null);
      }
    };
  }, []);

  // Handle layer changes
  useEffect(() => {
    if (!map) return;

    if (tilesRef.current) {
      map.removeLayer(tilesRef.current);
    }

    let url = '';
    let attribution = '';

    if (mapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community';
    } else if (mapType === 'terrain') {
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
    } else {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    }

    const tiles = L.tileLayer(url, {
      attribution,
      subdomains: mapType === 'standard' ? 'abcd' : 'abc',
      maxZoom: mapType === 'satellite' ? 18 : 20
    }).addTo(map);

    tilesRef.current = tiles;

    // Small delay to ensure container height is processed
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [mapType, map]);

  // Handle Draft Marker (Leaflet)
  useEffect(() => {
    if (!map) return;
    
    if (draftLocation && !isNaN(draftLocation.lat) && !isNaN(draftLocation.lng)) {
      const pos: L.LatLngExpression = [draftLocation.lat, draftLocation.lng];
      if (draftMarkerRef.current) {
        draftMarkerRef.current.setLatLng(pos);
      } else {
        const iconHtml = `
          <div style="
            width: 40px; 
            height: 40px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
          ">
            <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4f46e5" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="9" r="3" fill="white"/>
            </svg>
          </div>
        `;
        const draftIcon = L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });
        draftMarkerRef.current = L.marker(pos, { icon: draftIcon, zIndexOffset: 3000 }).addTo(map);
      }
    } else if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }
  }, [map, draftLocation]);

  // Update Markers
  useEffect(() => {
    if (!map) return;

    const bounds = L.latLngBounds([]);
    let hasMarkers = false;

    drivers?.forEach(driver => {
      // Validate coordinates
      if (!driver.isOnline || typeof driver.latitude !== 'number' || typeof driver.longitude !== 'number' || isNaN(driver.latitude) || isNaN(driver.longitude)) {
        if (markersRef.current[driver.id]) {
          markersRef.current[driver.id].remove();
          delete markersRef.current[driver.id];
        }
        return;
      }

      bounds.extend([driver.latitude, driver.longitude]);
      hasMarkers = true;

      const isSelected = driver.id === selectedDriverId;
      
      let colorClass = 'bg-blue-600'; // Default IN_TRANSIT
      if (driver.status === 'DELIVERED') colorClass = 'bg-emerald-500';
      else if (driver.status === 'DELAYED') colorClass = 'bg-amber-500';
      
      const pulseClass = isSelected ? 'animate-ping' : '';
      const borderClass = isSelected ? 'border-white scale-125 z-50' : 'border-white/20';

      // --- CREATIVE LIBERTY: "LIVE RADAR" STYLE ---
      // High-contrast, futuristic "Live Tracking" aesthetic
      
      const isActive = driver.status === 'IN_TRANSIT' || driver.status === 'DELAYED';
      
      // Neon Palette for Dark Map
      let color = '#00f0ff'; // Cyan (In Transit)
      let glowColor = 'rgba(0, 240, 255, 0.5)';
      
      if (driver.status === 'DELIVERED') {
        color = '#39ff14'; // Neon Green
        glowColor = 'rgba(57, 255, 20, 0.5)';
      } else if (driver.status === 'DELAYED') {
        color = '#ff00ff'; // Magenta
        glowColor = 'rgba(255, 0, 255, 0.5)';
      }

      // Truck Icon (Simplified for small sizes)
      const truckIcon = `
        <svg viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      `;
      
      // Radar Pulse Animation CSS (injected inline for reliability)
      const pulseAnimation = `
        @keyframes radar-pulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `;

      const size = isSelected ? 54 : 42;
      
      const iconHtml = `
        <style>${pulseAnimation}</style>
        <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
          
          <!-- Radar Pulse Ring (Only for active drivers) -->
          ${isActive ? `
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: ${glowColor};
              animation: radar-pulse 2s infinite ease-out;
              z-index: 0;
            "></div>
          ` : ''}

          <!-- Core Marker -->
          <div style="
            position: relative;
            z-index: 10;
            width: ${size * 0.8}px;
            height: ${size * 0.8}px;
            background: rgba(20, 20, 30, 0.9);
            border: 2px solid ${color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px ${glowColor}, inset 0 0 10px ${glowColor};
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
          ">
            <div style="width: 70%; height: 70%;">
              ${truckIcon}
            </div>
          </div>
          
          <!-- Label (Only when selected) -->
          ${isSelected ? `
            <div style="
              position: absolute;
              bottom: -25px;
              background: ${color};
              color: #000;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.5);
              z-index: 20;
            ">
              ${driver.name}
            </div>
          ` : ''}

        </div>
      `;

      const customIcon = L.divIcon({
        className: '', // No default styles
        html: iconHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng([driver.latitude, driver.longitude]);
        markersRef.current[driver.id].setIcon(customIcon);
        markersRef.current[driver.id].setZIndexOffset(isSelected ? 1000 : 0);
      } else {
        const marker = L.marker([driver.latitude, driver.longitude], { icon: customIcon }).addTo(map);
        marker.on('click', () => onSelectDriver(driver.id));
        markersRef.current[driver.id] = marker;
      }
    });

    // Cleanup
    Object.keys(markersRef.current).forEach(id => {
      if (!drivers?.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Handle Merchant Markers (Always visible)
    if (!showOnlyActiveDestination) {
      merchants?.forEach(merchant => {
        if (isNaN(merchant.latitude) || isNaN(merchant.longitude)) return;
        const pos: L.LatLngExpression = [merchant.latitude, merchant.longitude];
        bounds.extend(pos);
        hasMarkers = true;
        
        const iconHtml = `
          <div style="
            width: 32px;
            height: 32px;
            background: #64748b; 
            border: 2px solid #fff;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          ">
            <svg viewBox="0 0 24 24" fill="#fff" style="width: 18px; height: 18px;">
              <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-8-2h4v2h-4V4zm8 14H4V8h16v10z"/>
            </svg>
          </div>
        `;

        const merchantIcon = L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        if (merchantMarkersRef.current[merchant.id]) {
          merchantMarkersRef.current[merchant.id].setLatLng(pos);
        } else {
          const marker = L.marker(pos, { icon: merchantIcon }).addTo(map);
          marker.bindTooltip(merchant.name, { permanent: false, direction: 'top' });
          merchantMarkersRef.current[merchant.id] = marker;
        }
      });
    }

    // Cleanup Merchant Markers
    Object.keys(merchantMarkersRef.current).forEach(id => {
      if (showOnlyActiveDestination || !merchants?.find(m => m.id === id)) {
        merchantMarkersRef.current[id].remove();
        delete merchantMarkersRef.current[id];
      }
    });

    // Handle Destination Markers (Leaflet) - Selected Driver ONLY
    const activeDests: Set<string> = new Set();
    
    const selectedDriver = drivers?.find(d => d.id === selectedDriverId);
    if (selectedDriver && selectedDriver.isOnline && selectedDriver.cargo) {
      const nextItem = selectedDriver.cargo.find(c => c.status !== 'DELIVERED');
      if (nextItem) {
        const merchant = merchants?.find(m => m.id === nextItem.merchantId);
        if (merchant && !isNaN(merchant.latitude) && !isNaN(merchant.longitude)) {
          const key = `dest-${selectedDriver.id}-${merchant.id}-${nextItem.id}`;
          activeDests.add(key);

          const popupHtml = `
            <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
              <div style="color: #ef4444; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px;">
                Next Destination
              </div>
              <div style="color: #1e293b; font-size: 16px; font-weight: 700; margin-bottom: 2px; white-space: normal;">
                ${merchant.name}
              </div>
              <div style="color: #64748b; font-size: 12px; margin-bottom: 12px;">
                ${merchant.sector}
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}" 
                 target="_blank" 
                 style="display: block; width: 100%; text-align: center; background: #ef4444; color: white; text-decoration: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; box-sizing: border-box;">
                NAVIGATE
              </a>
            </div>
          `;

          if (destMarkersRef.current[key]) {
            destMarkersRef.current[key].setLatLng([merchant.latitude, merchant.longitude]);
            destMarkersRef.current[key].setPopupContent(popupHtml);
          } else {
            const marker = L.circleMarker([merchant.latitude, merchant.longitude], {
              radius: 6,
              fillColor: "#ef4444",
              color: "#fff",
              weight: 2,
              opacity: 1,
              fillOpacity: 1
            }).addTo(map);

            marker.bindPopup(popupHtml, {
              className: 'custom-destination-popup',
              offset: [0, -5]
            });

            if (lastOpenedDestRef.current !== key && !manuallyClosedDestsRef.current.has(key)) {
              marker.openPopup();
              lastOpenedDestRef.current = key;
            }

            marker.on('popupclose', () => {
              manuallyClosedDestsRef.current.add(key);
            });

            marker.on('click', () => {
              manuallyClosedDestsRef.current.delete(key);
              marker.openPopup();
            });

            destMarkersRef.current[key] = marker;
          }
        }
      }
    }

    // Cleanup dest markers
    Object.keys(destMarkersRef.current).forEach(key => {
      if (!activeDests.has(key)) {
        destMarkersRef.current[key].remove();
        delete destMarkersRef.current[key];
      }
    });

    // Auto-fit bounds if no driver selected and we have markers
    if (hasMarkers && !selectedDriverId && recenterCount === 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [drivers, merchants, selectedDriverId, onSelectDriver, map, recenterCount]);

  // Fly to selected driver (Leaflet)
  useEffect(() => {
    if (!map || !selectedDriverId) return;

    const driver = drivers?.find(d => d.id === selectedDriverId);
    if (driver && driver.isOnline && !isNaN(driver.latitude) && !isNaN(driver.longitude)) {
      map.flyTo([driver.latitude, driver.longitude], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selectedDriverId, recenterCount, map]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full bg-slate-900" />
      <MapToggle current={mapType} onChange={setMapType} />
      
      {/* Recenter Button */}
      {selectedDriverId && (
        <button 
          onClick={() => setRecenterCount(prev => prev + 1)}
          className="absolute bottom-6 right-4 z-[1000] p-3 rounded-full shadow-2xl transition-all border bg-slate-900/90 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800"
          title="Recenter to Driver"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  );
};

// --- TOGGLE COMPONENT ---
const MapToggle: React.FC<{ current: MapType, onChange: (type: MapType) => void }> = ({ current, onChange }) => {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700 p-1 shadow-2xl overflow-hidden scale-90 sm:scale-100">
      {(['standard', 'satellite', 'terrain'] as MapType[]).map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            current === type 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
};
