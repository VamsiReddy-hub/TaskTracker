import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import LeafletMap from "@/components/LeafletMap";
import {
  ArrowLeft, Phone, MessageCircle, CheckCircle, Clock,
  Package, Truck, Home, MapPin
} from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  pickupAddress: string;
  orderTotal: string;
  status: string;
  createdAt: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  deliveryPartnerId?: number;
}

interface LocationUpdate {
  id: number;
  latitude: string;
  longitude: string;
  timestamp: string;
}

export default function CustomerTracking() {
  const { user, logout } = useAuth();
  const [, params] = useRoute("/tracking/:orderNumber");
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // If orderNumber is provided in URL, use it, otherwise fetch customer's orders
  const orderNumber = params?.orderNumber;

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !orderNumber, // Only fetch if no specific order number
    refetchInterval: refreshInterval
  });

  // Fetch specific order by number
  const { data: specificOrder, isLoading: specificOrderLoading } = useQuery<Order>({
    queryKey: [`/api/orders/by-number/${orderNumber}`],
    enabled: !!orderNumber,
    refetchInterval: refreshInterval
  });

  // Get the order to track
  const trackingOrder = specificOrder || (orders.length > 0 ? orders.find(o => 
    ['assigned', 'picked_up', 'in_transit'].includes(o.status)
  ) || orders[0] : null);

  // Fetch location updates for the delivery partner
  const { data: locationUpdates = [], isLoading: locationLoading } = useQuery<LocationUpdate[]>({
    queryKey: [`/api/location/history/${trackingOrder?.deliveryPartnerId}`, trackingOrder?.id],
    enabled: !!trackingOrder?.deliveryPartnerId,
    refetchInterval: 3000 // More frequent updates for location
  });

  const latestLocation = locationUpdates[0];

  // Status timeline data
  const getStatusTimeline = (order: Order) => {
    const timeline = [
      {
        status: 'confirmed',
        label: 'Order Confirmed',
        time: order.createdAt,
        completed: true,
        icon: CheckCircle
      },
      {
        status: 'preparing',
        label: 'Preparing Order',
        time: order.createdAt, // In real app, this would be separate
        completed: true,
        icon: Package
      },
      {
        status: 'assigned',
        label: 'Driver Assigned',
        time: order.createdAt, // In real app, this would be when assigned
        completed: ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(order.status),
        icon: Truck
      },
      {
        status: 'picked_up',
        label: 'Order Picked Up',
        time: order.createdAt, // In real app, this would be pickup time
        completed: ['picked_up', 'in_transit', 'delivered'].includes(order.status),
        icon: Package
      },
      {
        status: 'in_transit',
        label: 'Out for Delivery',
        time: order.createdAt, // In real app, this would be transit start time
        completed: ['in_transit', 'delivered'].includes(order.status),
        current: order.status === 'in_transit',
        icon: Truck
      },
      {
        status: 'delivered',
        label: 'Delivered',
        time: order.actualDeliveryTime,
        completed: order.status === 'delivered',
        icon: Home
      }
    ];

    return timeline;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const getETA = (order: Order) => {
    if (order.estimatedDeliveryTime) {
      const eta = new Date(order.estimatedDeliveryTime);
      const now = new Date();
      const diffMinutes = Math.max(0, Math.floor((eta.getTime() - now.getTime()) / (1000 * 60)));
      return diffMinutes;
    }
    return 15; // Default estimate
  };

  if (ordersLoading || specificOrderLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!trackingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Orders Found</h2>
            <p className="text-neutral mb-4">
              {orderNumber ? 
                `Order ${orderNumber} not found or you don't have access to it.` : 
                "You don't have any orders to track yet."
              }
            </p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeline = getStatusTimeline(trackingOrder);
  const eta = getETA(trackingOrder);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="font-semibold text-gray-900">Track Your Order</h1>
            <p className="text-xs text-neutral">{trackingOrder.orderNumber}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Phone className="w-5 h-5 text-gray-600" />
        </Button>
      </header>

      {/* Order Status Timeline */}
      <div className="p-4 bg-gray-50">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Status</CardTitle>
            {trackingOrder.status === 'in_transit' && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600">ETA: {eta} minutes</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.map((step, index) => (
              <div key={step.status} className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step.completed ? 'bg-green-500' : 
                  step.current ? 'bg-primary animate-pulse' : 
                  'bg-gray-300'
                }`}>
                  <step.icon className={`text-xs ${
                    step.completed || step.current ? 'text-white' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.completed ? 'text-gray-900' : 
                    step.current ? 'text-primary' : 
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-neutral">
                    {step.completed && step.time ? formatTime(step.time) : 
                     step.current ? 'In progress...' : 
                     'Pending'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Live Tracking Map */}
      <div className="flex-1 p-4">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Live Tracking</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-neutral">Live</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-full min-h-[300px]">
              {latestLocation ? (
                <LeafletMap 
                  deliveries={[{
                    id: trackingOrder.id,
                    orderNumber: trackingOrder.orderNumber,
                    customerName: trackingOrder.customerName,
                    partnerName: 'Your Driver',
                    latitude: parseFloat(latestLocation.latitude),
                    longitude: parseFloat(latestLocation.longitude)
                  }]}
                  center={[parseFloat(latestLocation.latitude), parseFloat(latestLocation.longitude)]}
                  zoom={15}
                />
              ) : (
                <div className="h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">
                      {trackingOrder.status === 'assigned' ? 
                        'Driver will start tracking soon' :
                        trackingOrder.deliveryPartnerId ? 
                          'Getting driver location...' :
                          'Waiting for driver assignment'
                      }
                    </p>
                    {trackingOrder.deliveryPartnerId && (
                      <div className="mt-4 p-3 bg-white rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-900">Driver Assigned</p>
                        <p className="text-xs text-neutral">ETA: {eta} minutes</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details */}
      <div className="p-4 border-t border-gray-200">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-medium text-gray-900">Order Details</p>
                <p className="text-sm text-neutral">{trackingOrder.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">${trackingOrder.orderTotal}</p>
                <Badge className="bg-primary text-white mt-1">
                  {trackingOrder.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-neutral">Delivery to:</span>
              </div>
              <p className="text-sm text-gray-900 ml-6">{trackingOrder.deliveryAddress}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Actions */}
      {trackingOrder.deliveryPartnerId && (
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex space-x-3">
            <Button className="flex-1 bg-primary hover:bg-blue-700">
              <Phone className="w-4 h-4 mr-2" />
              Call Driver
            </Button>
            <Button variant="outline" className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
