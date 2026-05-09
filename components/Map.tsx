import React, { useEffect, useRef, useState } from 'react';
import { Driver } from '../types';
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
  selectedDriverId: string | null;
  onSelectDriver: (id: string) => void;
}

export const Map: React.FC<MapProps> = ({ drivers, selectedDriverId, onSelectDriver }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any | null>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const [apiLoaded, setApiLoaded] = useState(false);

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

  // Update Google Map Markers
  useEffect(() => {
    if (!mapInstance || !apiLoaded) return;

    drivers.forEach(driver => {
      // If offline or invalid coordinates, remove marker
      if (!driver.isOnline || typeof driver.latitude !== 'number' || typeof driver.longitude !== 'number' || isNaN(driver.latitude) || isNaN(driver.longitude)) {
        if (markersRef.current[driver.id]) {
          markersRef.current[driver.id].setMap(null);
          delete markersRef.current[driver.id];
        }
        return;
      }

      const position = { lat: driver.latitude, lng: driver.longitude };
      
      if (markersRef.current[driver.id]) {
        // Update existing
        markersRef.current[driver.id].setPosition(position);
        markersRef.current[driver.id].setIcon(getIcon(driver.id === selectedDriverId, driver.status));
      } else {
        // Create new
        const marker = new window.google.maps.Marker({
          position,
          map: mapInstance,
          title: driver.name,
          icon: getIcon(driver.id === selectedDriverId, driver.status),
        });
        
        marker.addListener("click", () => {
          onSelectDriver(driver.id);
        });

        markersRef.current[driver.id] = marker;
      }
    });

    // Cleanup removed drivers
    Object.keys(markersRef.current).forEach(id => {
      if (!drivers.find(d => d.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

  }, [drivers, mapInstance, selectedDriverId, onSelectDriver, apiLoaded]);

  // Pan to selected driver (Google Maps)
  useEffect(() => {
    if (!mapInstance || !selectedDriverId) return;
    
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (driver && driver.isOnline) {
      mapInstance.panTo({ lat: driver.latitude, lng: driver.longitude });
      mapInstance.setZoom(15);
    }
  }, [selectedDriverId, mapInstance, drivers]);

  const getIcon = (isSelected: boolean, status: string) => {
    // Neon Palette
    let color = '#00f0ff'; // Cyan
    if (status === 'DELIVERED') color = '#39ff14'; // Neon Green
    else if (status === 'DELAYED') color = '#ff00ff'; // Magenta

    // Truck Path
    const truckPath = "M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z";

    return {
      path: truckPath,
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#000000", // Black outline for contrast
      scale: isSelected ? 1.5 : 1.2,
      anchor: new window.google.maps.Point(12, 12)
    };
  };

  if (!apiLoaded) {
    // Use Leaflet for Satellite View
    return <LeafletMap drivers={drivers} selectedDriverId={selectedDriverId} onSelectDriver={onSelectDriver} />;
  }

  return <div ref={mapRef} className="w-full h-full" />;
};

// --- LEAFLET SATELLITE MAP ---
const LeafletMap: React.FC<MapProps> = ({ drivers, selectedDriverId, onSelectDriver }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  // Initialize Leaflet
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [17.0746, -61.8175], // Antigua
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // CartoDB Dark Matter (Dark Mode Street View)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {}; // Clear markers on map destroy
      }
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    drivers.forEach(driver => {
      // Validate coordinates
      if (!driver.isOnline || typeof driver.latitude !== 'number' || typeof driver.longitude !== 'number' || isNaN(driver.latitude) || isNaN(driver.longitude)) {
        if (markersRef.current[driver.id]) {
          markersRef.current[driver.id].remove();
          delete markersRef.current[driver.id];
        }
        return;
      }

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

      const size = isSelected ? 50 : 36;
      
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
      if (!drivers.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

  }, [drivers, selectedDriverId, onSelectDriver]);

  // Fly to selected driver (Leaflet)
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedDriverId) return;

    const driver = drivers.find(d => d.id === selectedDriverId);
    if (driver && driver.isOnline) {
      mapInstanceRef.current.flyTo([driver.latitude, driver.longitude], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selectedDriverId, drivers]);

  return <div ref={mapContainerRef} className="w-full h-full bg-slate-900" />;
};
