import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { 
  loginSchema, insertUserSchema, insertVendorSchema, insertDeliveryPartnerSchema,
  insertOrderSchema, updateLocationSchema, updateOrderStatusSchema
} from "@shared/schema";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    vendorId?: number;
    deliveryPartnerId?: number;
  };
}

// Middleware
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    // Add vendor/partner ID if applicable
    if (user.role === 'vendor') {
      const vendor = await storage.getVendorByUserId(user.id);
      if (vendor) req.user.vendorId = vendor.id;
    } else if (user.role === 'delivery') {
      const partner = await storage.getDeliveryPartnerByUserId(user.id);
      if (partner) req.user.deliveryPartnerId = partner.id;
    }

    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// WebSocket server instance
let io: SocketIOServer;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByUsername(userData.username) || 
                          await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Create role-specific profile
      if (userData.role === 'vendor' && req.body.vendorData) {
        const vendorData = insertVendorSchema.parse(req.body.vendorData);
        await storage.createVendor({
          ...vendorData,
          userId: user.id
        });
      } else if (userData.role === 'delivery' && req.body.partnerData) {
        const partnerData = insertDeliveryPartnerSchema.parse(req.body.partnerData);
        await storage.createDeliveryPartner({
          ...partnerData,
          userId: user.id
        });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        }
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Registration failed' });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        }
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Login failed' });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    });
  });

  // Order routes
  app.post("/api/orders", authenticateToken, requireRole(['vendor', 'customer']), async (req: AuthenticatedRequest, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      
      if (req.user!.role === 'vendor' && req.user!.vendorId) {
        orderData.vendorId = req.user!.vendorId;
      }
      
      if (req.user!.role === 'customer') {
        orderData.customerId = req.user!.id;
      }

      const order = await storage.createOrder(orderData);
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Order creation failed' });
    }
  });

  app.get("/api/orders", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      let orders;
      
      if (req.user!.role === 'vendor' && req.user!.vendorId) {
        orders = await storage.getOrdersByVendor(req.user!.vendorId);
      } else if (req.user!.role === 'customer') {
        orders = await storage.getOrdersByCustomer(req.user!.id);
      } else if (req.user!.role === 'delivery' && req.user!.deliveryPartnerId) {
        orders = await storage.getOrdersByDeliveryPartner(req.user!.deliveryPartnerId);
      } else {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get("/api/orders/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check permissions
      const hasAccess = 
        (req.user!.role === 'vendor' && order.vendorId === req.user!.vendorId) ||
        (req.user!.role === 'customer' && order.customerId === req.user!.id) ||
        (req.user!.role === 'delivery' && order.deliveryPartnerId === req.user!.deliveryPartnerId);

      if (!hasAccess) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  // Get order by order number (for customer tracking)
  app.get("/api/orders/by-number/:orderNumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const order = await storage.getOrderByNumber(req.params.orderNumber);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check permissions - customers can track any order with the number, others need specific access
      const hasAccess = 
        req.user!.role === 'customer' ||
        (req.user!.role === 'vendor' && order.vendorId === req.user!.vendorId) ||
        (req.user!.role === 'delivery' && order.deliveryPartnerId === req.user!.deliveryPartnerId);

      if (!hasAccess) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  app.patch("/api/orders/:id/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = updateOrderStatusSchema.parse(req.body);
      const orderId = parseInt(req.params.id);
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check permissions
      const canUpdate = 
        (req.user!.role === 'vendor' && order.vendorId === req.user!.vendorId) ||
        (req.user!.role === 'delivery' && order.deliveryPartnerId === req.user!.deliveryPartnerId);

      if (!canUpdate) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.updateOrderStatus(orderId, status);
      res.json({ message: 'Order status updated' });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Status update failed' });
    }
  });

  app.patch("/api/orders/:id/assign", authenticateToken, requireRole(['vendor']), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { deliveryPartnerId } = req.body;
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (order.vendorId !== req.user!.vendorId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const partner = await storage.getDeliveryPartner(deliveryPartnerId);
      if (!partner || !partner.isOnline) {
        return res.status(400).json({ message: 'Delivery partner not available' });
      }

      await storage.assignDeliveryPartner(orderId, deliveryPartnerId);
      res.json({ message: 'Delivery partner assigned' });
    } catch (error) {
      res.status(400).json({ message: 'Assignment failed' });
    }
  });

  // Delivery Partner routes
  app.get("/api/delivery-partners", authenticateToken, requireRole(['vendor']), async (req: AuthenticatedRequest, res) => {
    try {
      const partners = await storage.getAvailableDeliveryPartners();
      
      // Populate user information
      const partnersWithUsers = await Promise.all(
        partners.map(async (partner) => {
          const user = await storage.getUser(partner.userId);
          return {
            ...partner,
            user: user ? {
              fullName: user.fullName,
              phone: user.phone,
              email: user.email
            } : null
          };
        })
      );
      
      res.json(partnersWithUsers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch delivery partners' });
    }
  });

  app.patch("/api/delivery-partners/status", authenticateToken, requireRole(['delivery']), async (req: AuthenticatedRequest, res) => {
    try {
      const { isOnline } = req.body;
      
      if (!req.user!.deliveryPartnerId) {
        return res.status(400).json({ message: 'Delivery partner profile not found' });
      }

      await storage.updateDeliveryPartnerStatus(req.user!.deliveryPartnerId, isOnline);
      res.json({ message: 'Status updated' });
    } catch (error) {
      res.status(400).json({ message: 'Status update failed' });
    }
  });

  // Location routes
  app.post("/api/location/update", authenticateToken, requireRole(['delivery']), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude, orderId } = updateLocationSchema.parse(req.body);
      
      if (!req.user!.deliveryPartnerId) {
        return res.status(400).json({ message: 'Delivery partner profile not found' });
      }

      // Update partner's current location
      await storage.updateDeliveryPartnerLocation(req.user!.deliveryPartnerId, latitude, longitude);
      
      // Create location history entry
      await storage.createLocationUpdate({
        deliveryPartnerId: req.user!.deliveryPartnerId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        orderId
      });

      res.json({ message: 'Location updated' });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Location update failed' });
    }
  });

  app.get("/api/location/partner/:partnerId", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const location = await storage.getLatestLocationForPartner(partnerId);
      
      if (!location) {
        return res.status(404).json({ message: 'No location data found' });
      }

      res.json(location);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch location' });
    }
  });

  app.get("/api/location/history/:partnerId", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const orderId = req.query.orderId ? parseInt(req.query.orderId as string) : undefined;
      
      const history = await storage.getLocationHistory(partnerId, orderId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch location history' });
    }
  });

  // Stats for vendor dashboard
  app.get("/api/stats/vendor", authenticateToken, requireRole(['vendor']), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user!.vendorId) {
        return res.status(400).json({ message: 'Vendor profile not found' });
      }

      const orders = await storage.getOrdersByVendor(req.user!.vendorId);
      const partners = await storage.getAvailableDeliveryPartners();
      
      const activeOrders = orders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status));
      const todayOrders = orders.filter(o => {
        const today = new Date();
        const orderDate = new Date(o.createdAt!);
        return orderDate.toDateString() === today.toDateString();
      });

      const revenue = todayOrders.reduce((sum, order) => sum + parseFloat(order.orderTotal), 0);
      
      const deliveredToday = todayOrders.filter(o => o.status === 'delivered');
      const avgDeliveryTime = deliveredToday.length > 0 
        ? Math.round(deliveredToday.reduce((sum, order) => {
            if (order.actualDeliveryTime && order.createdAt) {
              return sum + (new Date(order.actualDeliveryTime).getTime() - new Date(order.createdAt).getTime());
            }
            return sum;
          }, 0) / deliveredToday.length / (1000 * 60)) // Convert to minutes
        : 30;

      res.json({
        activeOrders: activeOrders.length,
        activePartners: partners.length,
        avgDeliveryTime: `${avgDeliveryTime}m`,
        revenue: `${revenue.toFixed(2)}`
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize Socket.IO for real-time tracking
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/socket.io/"
  });

  // WebSocket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await storage.getUser(decoded.userId);
      
      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.data.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // WebSocket connection handling
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`User ${user.username} (${user.role}) connected`);

    // Join role-specific rooms
    socket.join(`role_${user.role}`);
    socket.join(`user_${user.id}`);

    // Handle delivery partner location updates
    if (user.role === 'delivery') {
      socket.on('location_update', async (data) => {
        try {
          const { latitude, longitude, orderId } = data;
          
          // Get delivery partner ID
          const partner = await storage.getDeliveryPartnerByUserId(user.id);
          if (!partner) return;

          // Update location in database
          await storage.updateDeliveryPartnerLocation(partner.id, latitude, longitude);
          
          // Create location history entry
          await storage.createLocationUpdate({
            deliveryPartnerId: partner.id,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            orderId
          });

          // Broadcast location update to relevant parties
          if (orderId) {
            const order = await storage.getOrder(orderId);
            if (order) {
              // Notify customer and vendor
              io.to(`user_${order.customerId}`).emit('delivery_location_update', {
                orderId,
                latitude,
                longitude,
                timestamp: new Date()
              });
              
              const vendor = await storage.getVendor(order.vendorId);
              if (vendor) {
                io.to(`user_${vendor.userId}`).emit('delivery_location_update', {
                  orderId,
                  latitude,
                  longitude,
                  timestamp: new Date()
                });
              }
            }
          }

          socket.emit('location_update_success');
        } catch (error) {
          socket.emit('location_update_error', { message: 'Failed to update location' });
        }
      });
    }

    // Handle order status updates
    socket.on('order_status_update', async (data) => {
      try {
        const { orderId, status } = data;
        
        const order = await storage.getOrder(orderId);
        if (!order) return;

        // Check permissions
        const canUpdate = 
          (user.role === 'vendor' && order.vendorId === user.vendorId) ||
          (user.role === 'delivery' && order.deliveryPartnerId === user.deliveryPartnerId);

        if (!canUpdate) return;

        await storage.updateOrderStatus(orderId, status);

        // Broadcast status update to all relevant parties
        io.to(`user_${order.customerId}`).emit('order_status_changed', {
          orderId,
          status,
          timestamp: new Date()
        });

        const vendor = await storage.getVendor(order.vendorId);
        if (vendor) {
          io.to(`user_${vendor.userId}`).emit('order_status_changed', {
            orderId,
            status,
            timestamp: new Date()
          });
        }

        if (order.deliveryPartnerId) {
          const partner = await storage.getDeliveryPartner(order.deliveryPartnerId);
          if (partner) {
            io.to(`user_${partner.userId}`).emit('order_status_changed', {
              orderId,
              status,
              timestamp: new Date()
            });
          }
        }

        socket.emit('order_status_update_success');
      } catch (error) {
        socket.emit('order_status_update_error', { message: 'Failed to update order status' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${user.username} disconnected`);
    });
  });

  return httpServer;
}
