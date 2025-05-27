import { 
  users, vendors, deliveryPartners, orders, locationUpdates,
  type User, type InsertUser, type Vendor, type InsertVendor,
  type DeliveryPartner, type InsertDeliveryPartner, type Order, type InsertOrder,
  type LocationUpdate, type InsertLocationUpdate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Vendor operations
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorByUserId(userId: number): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  
  // Delivery Partner operations
  getDeliveryPartner(id: number): Promise<DeliveryPartner | undefined>;
  getDeliveryPartnerByUserId(userId: number): Promise<DeliveryPartner | undefined>;
  createDeliveryPartner(partner: InsertDeliveryPartner): Promise<DeliveryPartner>;
  updateDeliveryPartnerLocation(partnerId: number, latitude: number, longitude: number): Promise<void>;
  updateDeliveryPartnerStatus(partnerId: number, isOnline: boolean): Promise<void>;
  getAvailableDeliveryPartners(): Promise<DeliveryPartner[]>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getOrdersByVendor(vendorId: number): Promise<Order[]>;
  getOrdersByCustomer(customerId: number): Promise<Order[]>;
  getOrdersByDeliveryPartner(partnerId: number): Promise<Order[]>;
  updateOrderStatus(orderId: number, status: string): Promise<void>;
  assignDeliveryPartner(orderId: number, partnerId: number): Promise<void>;
  
  // Location operations
  createLocationUpdate(update: InsertLocationUpdate): Promise<LocationUpdate>;
  getLatestLocationForPartner(partnerId: number): Promise<LocationUpdate | undefined>;
  getLocationHistory(partnerId: number, orderId?: number): Promise<LocationUpdate[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async getVendorByUserId(userId: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId));
    return vendor || undefined;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db
      .insert(vendors)
      .values(vendor)
      .returning();
    return newVendor;
  }

  async getDeliveryPartner(id: number): Promise<DeliveryPartner | undefined> {
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, id));
    return partner || undefined;
  }

  async getDeliveryPartnerByUserId(userId: number): Promise<DeliveryPartner | undefined> {
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId));
    return partner || undefined;
  }

  async createDeliveryPartner(partner: InsertDeliveryPartner): Promise<DeliveryPartner> {
    const [newPartner] = await db
      .insert(deliveryPartners)
      .values(partner)
      .returning();
    return newPartner;
  }

  async updateDeliveryPartnerLocation(partnerId: number, latitude: number, longitude: number): Promise<void> {
    await db
      .update(deliveryPartners)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        lastLocationUpdate: new Date()
      })
      .where(eq(deliveryPartners.id, partnerId));
  }

  async updateDeliveryPartnerStatus(partnerId: number, isOnline: boolean): Promise<void> {
    await db
      .update(deliveryPartners)
      .set({ isOnline })
      .where(eq(deliveryPartners.id, partnerId));
  }

  async getAvailableDeliveryPartners(): Promise<DeliveryPartner[]> {
    return await db
      .select()
      .from(deliveryPartners)
      .where(eq(deliveryPartners.isOnline, true));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}`;
    const [newOrder] = await db
      .insert(orders)
      .values({
        ...order,
        orderNumber,
        updatedAt: new Date()
      })
      .returning();
    return newOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async getOrdersByVendor(vendorId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.vendorId, vendorId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByDeliveryPartner(partnerId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPartnerId, partnerId))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(orderId: number, status: string): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'delivered') {
      updateData.actualDeliveryTime = new Date();
    }

    await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId));
  }

  async assignDeliveryPartner(orderId: number, partnerId: number): Promise<void> {
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30); // 30 min estimate

    await db
      .update(orders)
      .set({
        deliveryPartnerId: partnerId,
        status: 'assigned',
        estimatedDeliveryTime,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));
  }

  async createLocationUpdate(update: InsertLocationUpdate): Promise<LocationUpdate> {
    const [newUpdate] = await db
      .insert(locationUpdates)
      .values(update)
      .returning();
    return newUpdate;
  }

  async getLatestLocationForPartner(partnerId: number): Promise<LocationUpdate | undefined> {
    const [update] = await db
      .select()
      .from(locationUpdates)
      .where(eq(locationUpdates.deliveryPartnerId, partnerId))
      .orderBy(desc(locationUpdates.timestamp))
      .limit(1);
    return update || undefined;
  }

  async getLocationHistory(partnerId: number, orderId?: number): Promise<LocationUpdate[]> {
    const conditions = [eq(locationUpdates.deliveryPartnerId, partnerId)];
    
    if (orderId) {
      conditions.push(eq(locationUpdates.orderId, orderId));
    }

    return await db
      .select()
      .from(locationUpdates)
      .where(and(...conditions))
      .orderBy(desc(locationUpdates.timestamp));
  }
}

export const storage = new DatabaseStorage();
