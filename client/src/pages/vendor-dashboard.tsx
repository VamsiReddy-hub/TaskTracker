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
  Truck, Users, Clock, DollarSign, Plus, Bell, RotateCcw,
  ShoppingBag, Bike, Phone, MapPin, UserPlus
} from "lucide-react";

interface Stats {
  activeOrders: number;
  activePartners: number;
  avgDeliveryTime: string;
  revenue: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  orderTotal: string;
  status: string;
  createdAt: string;
  deliveryPartnerId?: number;
}

interface DeliveryPartner {
  id: number;
  userId: number;
  vehicleType: string;
  rating: string;
  totalDeliveries: number;
  isOnline: boolean;
  currentLatitude?: string;
  currentLongitude?: string;
  user?: {
    fullName: string;
    phone?: string;
  };
}

export default function VendorDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats/vendor"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch delivery partners
  const { data: deliveryPartners = [], isLoading: partnersLoading, refetch: refetchPartners } = useQuery<DeliveryPartner[]>({
    queryKey: ["/api/delivery-partners"],
    refetchInterval: 15000 // Refresh every 15 seconds
  });

  // Assign delivery partner mutation
  const assignPartnerMutation = useMutation({
    mutationFn: async ({ orderId, partnerId }: { orderId: number; partnerId: number }) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/assign`, { deliveryPartnerId: partnerId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Delivery partner assigned successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/vendor"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Assignment failed",
        variant: "destructive"
      });
    }
  });

  const handleRefresh = () => {
    refetchOrders();
    refetchPartners();
    queryClient.invalidateQueries({ queryKey: ["/api/stats/vendor"] });
    setLastUpdate(new Date());
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-amber-500",
      assigned: "bg-blue-500",
      picked_up: "bg-purple-500",
      in_transit: "bg-indigo-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500"
    };
    return colors[status as keyof typeof colors] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: "Pending",
      assigned: "Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled"
    };
    return labels[status as keyof typeof labels] || status;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000); // Update timestamp every minute

    return () => clearInterval(interval);
  }, []);

  // Prepare map data for active deliveries
  const activeDeliveries = orders
    .filter(order => order.status === 'in_transit' && order.deliveryPartnerId)
    .map(order => {
      const partner = deliveryPartners.find(p => p.id === order.deliveryPartnerId);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        partnerName: partner?.user?.fullName || 'Unknown',
        latitude: partner?.currentLatitude ? parseFloat(partner.currentLatitude) : null,
        longitude: partner?.currentLongitude ? parseFloat(partner.currentLongitude) : null
      };
    })
    .filter(delivery => delivery.latitude && delivery.longitude);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200 fixed h-full z-40">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">DeliveryHub</h1>
              <p className="text-sm text-neutral">Vendor Dashboard</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-6">
          <div className="px-6 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-white text-xs">
                  {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'V'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-gray-900">{user?.fullName || user?.username}</p>
                <p className="text-xs text-neutral">{user?.email}</p>
              </div>
            </div>
          </div>
          
          <ul className="space-y-2 px-3">
            <li>
              <div className="flex items-center space-x-3 px-3 py-2 bg-primary text-white rounded-lg">
                <i className="fas fa-tachometer-alt w-5"></i>
                <span>Dashboard</span>
              </div>
            </li>
            <li>
              <div className="flex items-center space-x-3 px-3 py-2 text-gray-700 rounded-lg">
                <ShoppingBag className="w-5 h-5" />
                <span>Orders</span>
                <Badge className="ml-auto bg-accent text-white">
                  {orders.filter(o => o.status === 'pending').length}
                </Badge>
              </div>
            </li>
            <li>
              <div className="flex items-center space-x-3 px-3 py-2 text-gray-700 rounded-lg">
                <Users className="w-5 h-5" />
                <span>Delivery Partners</span>
              </div>
            </li>
          </ul>
          
          <div className="mt-8 px-3">
            <Button
              onClick={logout}
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <i className="fas fa-sign-out-alt w-5 mr-3"></i>
              Logout
            </Button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h2>
              <p className="text-neutral">Manage your orders and delivery partners</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="icon">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs">3</Badge>
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral">Last updated:</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.floor((Date.now() - lastUpdate.getTime()) / 60000)} minutes ago
                </span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral">Active Orders</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statsLoading ? '...' : stats?.activeOrders || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="text-primary text-lg" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <i className="fas fa-arrow-up text-green-500 text-sm mr-1"></i>
                  <span className="text-sm text-green-500">+12% from yesterday</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral">Delivery Partners</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {partnersLoading ? '...' : stats?.activePartners || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Bike className="text-green-600 text-lg" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-neutral">
                    {deliveryPartners.filter(p => p.isOnline).length} active, {deliveryPartners.filter(p => !p.isOnline).length} offline
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral">Avg. Delivery Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statsLoading ? '...' : stats?.avgDeliveryTime || '30m'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Clock className="text-amber-600 text-lg" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <i className="fas fa-arrow-down text-green-500 text-sm mr-1"></i>
                  <span className="text-sm text-green-500">-3m from last week</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral">Revenue Today</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {statsLoading ? '...' : stats?.revenue || '$0.00'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-purple-600 text-lg" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <i className="fas fa-arrow-up text-green-500 text-sm mr-1"></i>
                  <span className="text-sm text-green-500">+18% from yesterday</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Tracking Map */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live Delivery Tracking</CardTitle>
                  <p className="text-neutral">Real-time locations of active deliveries</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button onClick={handleRefresh} className="bg-primary hover:bg-blue-700">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <div className="flex items-center space-x-2 text-sm text-neutral">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live Updates</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <LeafletMap deliveries={activeDeliveries} />
              </div>
            </CardContent>
          </Card>

          {/* Orders and Partners Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Orders</CardTitle>
                  <Button className="bg-primary hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {ordersLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8 text-neutral">
                      No orders yet
                    </div>
                  ) : (
                    orders.slice(0, 10).map((order) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-sm text-gray-600">{order.orderNumber}</span>
                            <Badge className={`${getStatusColor(order.status)} text-white`}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                          <span className="text-sm text-neutral">{formatTime(order.createdAt)}</span>
                        </div>
                        <div className="mb-3">
                          <p className="font-medium text-gray-900">{order.customerName}</p>
                          <p className="text-sm text-neutral">{order.deliveryAddress}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">${order.orderTotal}</span>
                          {order.status === 'pending' ? (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                // In a real app, this would open a partner selection dialog
                                const availablePartner = deliveryPartners.find(p => p.isOnline);
                                if (availablePartner) {
                                  assignPartnerMutation.mutate({
                                    orderId: order.id,
                                    partnerId: availablePartner.id
                                  });
                                } else {
                                  toast({
                                    title: "No Partners Available",
                                    description: "No delivery partners are currently online",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              disabled={assignPartnerMutation.isPending}
                            >
                              Assign Partner
                            </Button>
                          ) : order.status === 'assigned' || order.status === 'in_transit' ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-neutral">
                                {deliveryPartners.find(p => p.id === order.deliveryPartnerId)?.user?.fullName || 'Partner'}
                              </span>
                              <Button size="sm" variant="outline">
                                Track
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-green-600">Completed ✓</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Partners */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Delivery Partners</CardTitle>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Partner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {partnersLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : deliveryPartners.length === 0 ? (
                    <div className="text-center py-8 text-neutral">
                      No delivery partners registered
                    </div>
                  ) : (
                    deliveryPartners.map((partner) => (
                      <div key={partner.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <Avatar>
                              <AvatarFallback className="bg-primary text-white">
                                {partner.user?.fullName?.split(' ').map(n => n[0]).join('') || 'DP'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${partner.isOnline ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white rounded-full`}></div>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{partner.user?.fullName || 'Unknown'}</p>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-neutral capitalize">{partner.vehicleType}</span>
                              <span className="text-xs text-neutral">•</span>
                              <span className={`text-sm ${partner.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                                {partner.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {orders.filter(o => o.deliveryPartnerId === partner.id && ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length} orders
                          </p>
                          <p className="text-xs text-neutral">
                            {parseFloat(partner.rating).toFixed(1)} ⭐ ({partner.totalDeliveries} total)
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
