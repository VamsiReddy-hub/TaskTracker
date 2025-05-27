import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'vendor', 'delivery', 'customer'
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  businessName: text("business_name").notNull(),
  address: text("address").notNull(),
  description: text("description"),
  isVerified: boolean("is_verified").default(false)
});

export const deliveryPartners = pgTable("delivery_partners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  vehicleType: text("vehicle_type").notNull(), // 'motorcycle', 'bicycle', 'car'
  licenseNumber: text("license_number"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalDeliveries: integer("total_deliveries").default(0),
  isOnline: boolean("is_online").default(false),
  currentLatitude: decimal("current_latitude", { precision: 10, scale: 8 }),
  currentLongitude: decimal("current_longitude", { precision: 11, scale: 8 }),
  lastLocationUpdate: timestamp("last_location_update")
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  pickupAddress: text("pickup_address").notNull(),
  orderTotal: decimal("order_total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'
  deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 8 }),
  deliveryLongitude: decimal("delivery_longitude", { precision: 11, scale: 8 }),
  pickupLatitude: decimal("pickup_latitude", { precision: 10, scale: 8 }),
  pickupLongitude: decimal("pickup_longitude", { precision: 11, scale: 8 }),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const locationUpdates = pgTable("location_updates", {
  id: serial("id").primaryKey(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => deliveryPartners.id).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow()
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [users.id],
    references: [vendors.userId]
  }),
  deliveryPartner: one(deliveryPartners, {
    fields: [users.id],
    references: [deliveryPartners.userId]
  }),
  customerOrders: many(orders, { relationName: "customerOrders" })
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, {
    fields: [vendors.userId],
    references: [users.id]
  }),
  orders: many(orders)
}));

export const deliveryPartnersRelations = relations(deliveryPartners, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryPartners.userId],
    references: [users.id]
  }),
  orders: many(orders),
  locationUpdates: many(locationUpdates)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
    relationName: "customerOrders"
  }),
  vendor: one(vendors, {
    fields: [orders.vendorId],
    references: [vendors.id]
  }),
  deliveryPartner: one(deliveryPartners, {
    fields: [orders.deliveryPartnerId],
    references: [deliveryPartners.id]
  }),
  locationUpdates: many(locationUpdates)
}));

export const locationUpdatesRelations = relations(locationUpdates, ({ one }) => ({
  deliveryPartner: one(deliveryPartners, {
    fields: [locationUpdates.deliveryPartnerId],
    references: [deliveryPartners.id]
  }),
  order: one(orders, {
    fields: [locationUpdates.orderId],
    references: [orders.id]
  })
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true
});

export const insertDeliveryPartnerSchema = createInsertSchema(deliveryPartners).omit({
  id: true,
  rating: true,
  totalDeliveries: true,
  lastLocationUpdate: true
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true
});

export const insertLocationUpdateSchema = createInsertSchema(locationUpdates).omit({
  id: true,
  timestamp: true
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  orderId: z.number().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "assigned", "picked_up", "in_transit", "delivered", "cancelled"])
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertDeliveryPartner = z.infer<typeof insertDeliveryPartnerSchema>;
export type DeliveryPartner = typeof deliveryPartners.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertLocationUpdate = z.infer<typeof insertLocationUpdateSchema>;
export type LocationUpdate = typeof locationUpdates.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
export type UpdateLocationRequest = z.infer<typeof updateLocationSchema>;
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>;
