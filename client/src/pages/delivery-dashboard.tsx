import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LeafletMap from "@/components/LeafletMap";
import {
  ArrowLeft, Play, Pause, MapPin, Store, Phone, Navigation,
  Package, CheckCircle, Clock, Route
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
}

export default function DeliveryDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch orders assigned to this delivery partner
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const activeOrder = orders.find(order => 
    ['assigned', 'picked_up', 'in_transit'].includes(order.status)
  );

  // Update online status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (online: boolean) => {
      await apiRequest("PATCH", "/api/delivery-partners/status", { isOnline: online });
    },
    onSuccess: (_, online) => {
      setIsOnline(online);
      toast({
        title: online ? "You're now online" : "You're now offline",
        description: online ? "You can receive delivery requests" : "You won't receive new requests"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Status update failed",
        variant: "destructive"
      });
    }
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async (location: { latitude: number; longitude: number; orderId?: number }) => {
      await apiRequest("POST", "/api/location/update", location);
    },
    onError: (error) => {
      console.error("Location update failed:", error);
    }
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order status updated"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Status update failed",
        variant: "destructive"
      });
    }
  });

  // Location tracking
  useEffect(() => {
    let watchId: number;

    const startLocationTracking = () => {
      if (!navigator.geolocation) {
        toast({
          title: "Error",
          description: "Geolocation is not supported by this browser",
          variant: "destructive"
        });
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          
          if (isDelivering && activeOrder) {
            updateLocationMutation.mutate({
              latitude,
              longitude,
              orderId: activeOrder.id
            });
          }
        },
        (error) => {
          console.error("Location error:", error);
          toast({
            title: "Location Error",
            description: "Failed to get current location",
            variant: "destructive"
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    };

    if (isDelivering) {
      startLocationTracking();
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isDelivering, activeOrder]);

  // Auto-update location every 3 seconds when delivering
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isDelivering && currentLocation && activeOrder) {
      interval = setInterval(() => {
        updateLocationMutation.mutate({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          orderId: activeOrder.id
        });
      }, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isDelivering, currentLocation, activeOrder]);

  const handleStartDelivery = () => {
    if (!activeOrder) {
      toast({
        title: "No Active Order",
        description: "You need an assigned order to start delivery",
        variant: "destructive"
      });
      return;
    }

    setIsDelivering(true);
    updateStatusMutation.mutate(true);
    
    // Update order status to in_transit if it was assigned
    if (activeOrder.status === 'assigned') {
      updateOrderStatusMutation.mutate({
        orderId: activeOrder.id,
        status: 'picked_up'
      });
    }
  };

  const handleStopDelivery = () => {
    setIsDelivering(false);
    updateStatusMutation.mutate(false);
  };

  const handlePickedUp = () => {
    if (activeOrder) {
      updateOrderStatusMutation.mutate({
        orderId: activeOrder.id,
        status: 'in_transit'
      });
    }
  };

  const handleDelivered = () => {
    if (activeOrder) {
      updateOrderStatusMutation.mutate({
        orderId: activeOrder.id,
        status: 'delivered'
      });
      setIsDelivering(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      assigned: "bg-blue-500",
      picked_up: "bg-purple-500",
      in_transit: "bg-indigo-500",
      delivered: "bg-green-500"
    };
    return colors[status as keyof typeof colors] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Mobile Header */}
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-700"
            onClick={logout}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">Delivery Dashboard</h1>
            <p className="text-xs text-blue-200">{user?.fullName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-xs">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      {/* Status Card */}
      <div className="p-4 bg-gray-50">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-neutral">Current Status</span>
              <Badge className={`${isDelivering ? 'bg-green-500' : isOnline ? 'bg-blue-500' : 'bg-gray-500'} text-white`}>
                {isDelivering ? 'Delivering' : isOnline ? 'Available' : 'Offline'}
              </Badge>
            </div>
            
            {!isDelivering ? (
              <Button
                onClick={handleStartDelivery}
                className="w-full bg-primary text-white py-3 text-lg hover:bg-blue-700"
                disabled={updateStatusMutation.isPending || !activeOrder}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Delivery
              </Button>
            ) : (
              <Button
                onClick={handleStopDelivery}
                className="w-full bg-red-500 text-white py-3 text-lg hover:bg-red-600"
                disabled={updateStatusMutation.isPending}
              >
                <Pause className="w-5 h-5 mr-2" />
                Stop Delivery
              </Button>
            )}
            
            <p className="text-xs text-neutral text-center mt-2">
              {isDelivering ? 'Location sharing is active' : 'Location sharing will begin automatically'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Order */}
      <div className="flex-1 p-4 space-y-4">
        {activeOrder ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Active Order</CardTitle>
                  <span className="font-mono text-sm text-gray-600">{activeOrder.orderNumber}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pickup Location */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                    <Store className="text-white text-xs" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Pickup Location</p>
                    <p className="text-sm text-neutral">{activeOrder.pickupAddress}</p>
                    <Button size="sm" variant="outline" className="mt-2">
                      <Navigation className="w-4 h-4 mr-1" />
                      Get Directions
                    </Button>
                  </div>
                </div>

                {/* Delivery Location */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mt-1">
                    <MapPin className="text-white text-xs" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activeOrder.customerName}</p>
                    <p className="text-sm text-neutral">{activeOrder.deliveryAddress}</p>
                    <div className="flex space-x-2 mt-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button size="sm" variant="outline">
                        <Navigation className="w-4 h-4 mr-1" />
                        Directions
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-neutral">Order Value:</span>
                  <span className="font-semibold text-gray-900">${activeOrder.orderTotal}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral">Status:</span>
                  <Badge className={`${getStatusColor(activeOrder.status)} text-white`}>
                    {activeOrder.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handlePickedUp}
                className="bg-amber-500 text-white py-3 hover:bg-amber-600"
                disabled={updateOrderStatusMutation.isPending || activeOrder.status !== 'assigned'}
              >
                <Package className="w-5 h-5 mr-2" />
                Picked Up
              </Button>
              <Button
                onClick={handleDelivered}
                className="bg-green-500 text-white py-3 hover:bg-green-600"
                disabled={updateOrderStatusMutation.isPending || !['picked_up', 'in_transit'].includes(activeOrder.status)}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Delivered
              </Button>
            </div>

            {/* Mini Map */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Route className="w-5 h-5 mr-2" />
                  Route Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  {currentLocation ? (
                    <LeafletMap 
                      deliveries={[{
                        id: activeOrder.id,
                        orderNumber: activeOrder.orderNumber,
                        customerName: activeOrder.customerName,
                        partnerName: user?.fullName || 'You',
                        latitude: currentLocation.lat,
                        longitude: currentLocation.lng
                      }]} 
                      center={[currentLocation.lat, currentLocation.lng]}
                      zoom={15}
                    />
                  ) : (
                    <div className="h-full bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Route className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Getting location...</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Orders</h3>
              <p className="text-neutral">You'll see assigned orders here when available</p>
              <Button
                onClick={() => updateStatusMutation.mutate(true)}
                className="mt-4 bg-primary hover:bg-blue-700"
                disabled={updateStatusMutation.isPending || isOnline}
              >
                Go Online
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Order History */}
        {orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-neutral">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getStatusColor(order.status)} text-white text-xs`}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-neutral mt-1">{formatTime(order.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
