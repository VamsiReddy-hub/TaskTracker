import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Delivery {
  id: number;
  orderNumber: string;
  customerName: string;
  partnerName: string;
  latitude: number;
  longitude: number;
}

interface LeafletMapProps {
  deliveries: Delivery[];
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({ deliveries, center, zoom = 12 }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = center || [40.7128, -74.0060]; // NYC as default
      
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, zoom);
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Add new markers
    if (deliveries.length > 0) {
      const group = new L.FeatureGroup();

      deliveries.forEach((delivery) => {
        if (delivery.latitude && delivery.longitude) {
          // Create custom icon for delivery partner
          const deliveryIcon = L.divIcon({
            html: `
              <div style="
                background-color: #2563EB; 
                border: 3px solid white; 
                border-radius: 50%; 
                width: 24px; 
                height: 24px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              ">
                <i class="fas fa-motorcycle" style="color: white; font-size: 10px;"></i>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: 'custom-delivery-marker'
          });

          const marker = L.marker([delivery.latitude, delivery.longitude], { 
            icon: deliveryIcon 
          }).addTo(map);

          marker.bindPopup(`
            <div>
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${delivery.orderNumber}</h3>
              <p style="margin: 0 0 4px 0;"><strong>Customer:</strong> ${delivery.customerName}</p>
              <p style="margin: 0;"><strong>Driver:</strong> ${delivery.partnerName}</p>
            </div>
          `);

          markersRef.current.push(marker);
          group.addLayer(marker);
        }
      });

      // Fit map to show all markers if multiple deliveries
      if (deliveries.length > 1) {
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
      } else if (deliveries.length === 1 && center) {
        map.setView(center, zoom);
      }
    } else if (center) {
      // If no deliveries but center is provided, center the map there
      map.setView(center, zoom);
    }

    return () => {
      // Cleanup markers when component unmounts
      markersRef.current.forEach(marker => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    };
  }, [deliveries, center, zoom]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Map Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 space-y-2 z-[1000]">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <span className="text-xs text-gray-600">Delivery Partner</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-xs text-gray-600">Customer Location</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-xs text-gray-600">Restaurant/Store</span>
        </div>
      </div>

      {/* Loading indicator for empty state */}
      {deliveries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <i className="fas fa-map-marked-alt text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-600">No active deliveries to display</p>
          </div>
        </div>
      )}
    </div>
  );
}
